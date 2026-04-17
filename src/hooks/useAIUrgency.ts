import { useState } from "react";

export interface AIUrgencyResult {
  urgency: "low" | "medium" | "high" | "critical";
  window: string;
  reasoning: string;
}

export function useAIUrgency() {
  const [loading, setLoading] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [result, setResult] = useState<AIUrgencyResult | null>(null);

  const calculateUrgency = async (food: { items: string[]; category: string; cookedAt: string }) => {
    setLoading(true);
    setReasoningText("");
    setResult(null);

    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      // Fallback if no API key
      setResult({ urgency: "high", window: "4 hours", reasoning: "AI check unavailable. Defaulting to high urgency for safety." });
      setLoading(false);
      return;
    }

    const prompt = `You are a food safety expert. Analyze the following and determine the safety urgency.
      
Items: ${food.items.join(", ")}
Category: ${food.category}
Cooked at: ${food.cookedAt}
Current time: ${new Date().toISOString()}

Determine:
1. Urgency Level: low, medium, high, or critical. (Based on food type and age)
2. Safe-to-eat window: How many more hours it remains safe under standard conditions.
3. Reasoning: A brief 2-sentence explanation.

Return ONLY a valid JSON object with keys "urgency", "window", and "reasoning". Do not include markdown formatting.`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
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
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const jsonStr = line.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setReasoningText(prev => prev + content);
            }
          } catch {}
        }
      }

      // Parse JSON from the full response
      try {
        const clean = fullResponse.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setResult(parsed);
        setReasoningText(parsed.reasoning || "");
      } catch {
        console.error("Failed to parse AI response:", fullResponse);
        setResult({ urgency: "high", window: "4 hours", reasoning: "Could not parse AI response. Using safe default." });
      }
    } catch (err) {
      console.error("AI Urgency calculation failed:", err);
      setResult({ urgency: "high", window: "4 hours", reasoning: "AI service unavailable. Using safe default urgency." });
    } finally {
      setLoading(false);
    }
  };

  return { calculateUrgency, loading, reasoningText, result };
}
