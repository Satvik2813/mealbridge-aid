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

  const checkFoodSafety = async (base64ImageDataUrl: string) => {
    setLoading(true);
    setResult(null);

    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      toast.error("VITE_OPENROUTER_API_KEY not found in environment.");
      setLoading(false);
      return;
    }

    try {
      const prompt = `Direct food safety item check. Analyze the food condition and safety. 
      JSON Output: { "food": "name", "condition": "state", "safety": "SAFE|CAUTION|UNSAFE", "urgency": "level", "reason": "why" }`;
      
      const base64Data = base64ImageDataUrl.split(",")[1] || base64ImageDataUrl;
      const mimeMatch = base64ImageDataUrl.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const contentArray: any[] = [
        { type: "text", text: prompt },
        { 
          type: "image_url", 
          image_url: { url: `data:${mimeType};base64,${base64Data}` } 
        }
      ];

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

      const parsed = JSON.parse(text) as FoodSafetyResult;
      setResult(parsed);
    } catch (e: any) {
      console.error("Food safety check failed:", e);
      toast.error(e.message || "Failed to analyze image directly.");
    } finally {
      setLoading(false);
    }
  };

  return { checkFoodSafety, loading, result };
}
