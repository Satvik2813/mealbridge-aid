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
  suggested_expiry?: string;   // ISO string as suggested by AI
}

export function useAIUrgency() {
  const [loading, setLoading] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [result, setResult] = useState<AIUrgencyResult | null>(null);

  const calculateUrgency = async (food: {
    items: { name: string; qty: string; unit: string }[];
    category: string;
    cookedAt: string;
    imageFile?: File;
  }) => {
    setLoading(true);
    setReasoningText("");
    setResult(null);

    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("VITE_OPENROUTER_API_KEY not found.");
      // Fallback response if key is missing
      setLoading(false);
      return;
    }

    try {
      const itemsText = food.items.map((it: any) => `- ${it.qty} ${it.unit} of ${it.name}`).join("\n");
      const prompt = `Act as an elite, stringent Food Safety Forensic Analyst and Logistics Evaluator. You are evaluating a food donation request.
      
      EVIDENCE LOG:
      Category: ${food.category}
      Time Cooked/Prepared: ${food.cookedAt}
      Current Time: ${new Date().toISOString()}
      Food Items & Quantities:
      ${itemsText}
      
      CRITICAL INSTRUCTIONS for 100% ACCURACY:
      1. Calculate exactly how many hours have passed between "Time Cooked/Prepared" and "Current Time".
      2. Apply standard FDA rules (e.g. perishable hot food must be consumed within 4-6 hours if unrefrigerated).
      3. CAREFULLY set "suggested_expiry" based strictly on the cooking time plus the FDA safe window.
      4. Scale the "urgency" accurately based on time remaining before expiry: 
         - 'low' if largely fresh/just cooked.
         - 'medium' if halfway through safe window.
         - 'high' if close to expiry.
         - 'critical' ONLY if past expiry, or severe visual rot is verified.
      5. If visual evidence (image) is provided, you MUST explicitly state what you observe in the image inside your "reasoning".
      6. Realistically calculate the 'feed_count' based exactly on standard portion sizes. Do NOT exaggerate numbers. 
      7. Assign a realistic 'safety_score' (0-100) based on actual time elapsed and conditions.
      8. Explicitly list pragmatic 'risks'.
      9. Output MUST be perfectly valid JSON with NO markdown blocks around it.

      OUTPUT SCHEMA:
      {
        "urgency": "low|medium|high|critical",
        "window": "Exact safe time remaining (e.g., '2h 15m')",
        "reasoning": "Professional, detailed assessment. MUST describe the visual appearance of the food from the image.",
        "feed_count": <integer>,
        "per_item_servings": { "<Item Name>": <integer> },
        "storage_advice": "Strict instructions for immediate transportation or storage",
        "risks": ["Risk 1", "Risk 2"],
        "safety_score": <integer 0-100>,
        "suggested_expiry": "ISO_8601_TIMESTAMP"
      }`;

      let contentArray: any[] = [{ type: "text", text: prompt }];

      if (food.imageFile) {
        let base64Image = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(food.imageFile!);
        });
        
        contentArray.push({
          type: "image_url",
          image_url: {
            url: `data:${food.imageFile.type || "image/jpeg"};base64,${base64Image}`
          }
        });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "FeedLoop Logistics"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: contentArray }],
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errData}`);
      }

      const data = await response.json();
      let text = data.choices[0].message.content;
      text = text.replace(/```json|```/g, "").trim();
      
      const parsed = JSON.parse(text) as AIUrgencyResult;
      setResult(parsed);
      setReasoningText(parsed.reasoning || "");
    } catch (err: any) {
      console.error("Direct AI analysis failed:", err);
      // fallback result if error
      setResult({
        urgency: "high",
        window: "4 hours",
        reasoning: "AI analysis failed using OpenRouter fallback. Defaulting to high urgency.",
        feed_count: 10,
        per_item_servings: {},
        storage_advice: "Refrigerate immediately.",
        risks: ["Failed analysis. Verify manually."],
        safety_score: 50,
      });
    } finally {
      setLoading(false);
    }
  };

  return { calculateUrgency, loading, reasoningText, result };
}
