import { useState } from "react";

export interface AIUrgencyResult {
  urgency: "low" | "medium" | "high" | "critical";
  window: string;
  reasoning: string;
  feed_count: number;          // estimated people this batch can feed
  per_item_servings: Record<string, number>; // e.g. { "Biryani": 20, "Raita": 20 }
  storage_advice: string;      // how to store to extend life
  risks: string[];             // list of risk factors
  safety_score: number;        // 0-100
}

export function useAIUrgency() {
  const [loading, setLoading] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [result, setResult] = useState<AIUrgencyResult | null>(null);

  const calculateUrgency = async (food: {
    items: { name: string; qty: string; unit: string }[];
    category: string;
    cookedAt: string;
    photoCount?: number;
  }) => {
    setLoading(true);
    setReasoningText("");
    setResult(null);

    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      setResult({
        urgency: "high",
        window: "4 hours",
        reasoning: "AI check unavailable. Defaulting to high urgency for safety.",
        feed_count: food.items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0),
        per_item_servings: {},
        storage_advice: "Keep food covered and at room temperature for up to 2 hours.",
        risks: ["Exact safety window unknown without AI analysis."],
        safety_score: 60,
      });
      setLoading(false);
      return;
    }

    const itemsText = food.items
      .map((it) => `- ${it.qty} ${it.unit} of ${it.name}`)
      .join("\n");

    const minutesSinceCooked = Math.round(
      (Date.now() - new Date(food.cookedAt).getTime()) / 60000
    );

    const prompt = `You are an expert food safety analyst working with a food rescue platform.

FOOD SUBMISSION DETAILS:
Category: ${food.category}
Cooked at: ${food.cookedAt} (${minutesSinceCooked} minutes ago)
${food.photoCount ? `Photos provided: ${food.photoCount} (quality documentation present)` : "Photos: None provided"}
Current time: ${new Date().toISOString()}

FOOD ITEMS:
${itemsText}

TASK: Perform a comprehensive food safety and distribution analysis. Consider:
1. Food age since cooking and standard food safety guidelines
2. Item types (proteins, dairy, cooked rice, etc. spoil differently)
3. The donor category (${food.category} implies different preparation standards)
4. Photo documentation quality impact on trust score

You MUST respond strictly with ONLY a raw JSON object. NO markdown formatting. NO \`\`\`json blocks. NO explanations before or after. Begin exactly with { and end exactly with }:
{
  "urgency": "low|medium|high|critical",
  "window": "X hours Y minutes",
  "reasoning": "2-3 sentence food safety explanation covering age, type, and storage",
  "feed_count": <integer: total estimated people this can feed >,
  "per_item_servings": { "<item name>": <servings as integer>, ... },
  "storage_advice": "brief specific storage tip",
  "risks": ["<risk 1>", "<risk 2>"],
  "safety_score": <integer 0-100>
}`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "FeedLoop",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const jsonStr = line.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setReasoningText((prev) => prev + content);
            }
          } catch {}
        }
      }

      // Parse the final JSON
      try {
        const clean = fullResponse.replace(/```json|```/g, "").trim();
        // Extract JSON object if there's surrounding text
        const match = clean.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : clean) as AIUrgencyResult;
        setResult(parsed);
        setReasoningText(parsed.reasoning || "");
      } catch {
        console.error("Failed to parse AI response:", fullResponse);
        setResult({
          urgency: "high",
          window: "4 hours",
          reasoning: "Could not parse AI response. Using safe default.",
          feed_count: food.items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0),
          per_item_servings: {},
          storage_advice: "Keep covered and consume within 2 hours.",
          risks: ["AI analysis incomplete."],
          safety_score: 55,
        });
      }
    } catch (err) {
      console.error("AI Urgency calculation failed:", err);
      setResult({
        urgency: "high",
        window: "4 hours",
        reasoning: "AI service unavailable. Using safe default urgency.",
        feed_count: food.items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0),
        per_item_servings: {},
        storage_advice: "Keep covered and consume within 2 hours.",
        risks: ["Network error — manual safety check recommended."],
        safety_score: 50,
      });
    } finally {
      setLoading(false);
    }
  };

  return { calculateUrgency, loading, reasoningText, result };
}
