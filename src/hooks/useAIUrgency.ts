import { useState } from "react";
import { openrouter } from "@/lib/openrouter";

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

    try {
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

      const stream = await (openrouter.chat.send as any)({
        chatRequest: {
          model: "meta-llama/llama-3.1-8b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          setReasoningText((prev) => prev + content);
        }
      }

      // Try to extract JSON from the response
      try {
        const jsonStr = fullResponse.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        setResult(parsed);
      } catch (e) {
        console.error("Failed to parse AI response:", fullResponse);
        // Fallback or handle error
      }
    } catch (err) {
      console.error("AI Urgency calculation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return { calculateUrgency, loading, reasoningText, result };
}
