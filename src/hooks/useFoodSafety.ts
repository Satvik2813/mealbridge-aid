import { useState } from "react";
import { toast } from "sonner";

export interface FoodSafetyResult {
  food: string;
  condition: string;
  safety: string;
  urgency: string;
  reason: string;
}

export function useFoodSafety() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodSafetyResult | null>(null);

  const checkFoodSafety = async (base64Image: string) => {
    setLoading(true);
    setResult(null);
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI API key missing");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an AI Food Safety Checker integrated into a food donation platform.

Analyze the uploaded food image and provide a short, UI-friendly safety assessment.

Tasks:
1. Identify the food item.
2. Assess its condition: Fresh / Moderate / Spoiled.
3. Determine safety level:
   * SAFE ✅ (good to donate)
   * CAUTION ⚠️ (consume quickly)
   * UNSAFE ❌ (not suitable for donation)
4. Estimate urgency:
   * High (must be used immediately)
   * Medium (use soon)
   * Low (safe for some time)
5. Give a short reason (1 line only).

Output STRICTLY in this JSON format:
{
"food": "",
"condition": "",
"safety": "",
"urgency": "",
"reason": ""
}`
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        setResult(parsed);
      } else {
         console.error("OpenAI API Error:", data);
         toast.error("OpenAI API Error: " + (data.error?.message || "Unknown error"));
      }
    } catch (e: any) {
      console.error("Food safety check failed:", e);
      toast.error(e.message || "Failed to analyze image. Ensure API key is loaded.");
    } finally {
      setLoading(false);
    }
  };

  return { checkFoodSafety, loading, result };
}
