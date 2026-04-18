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
      const prompt = `Act as an elite Food Safety Forensic Analyst. Conduct a strict visual and safety spot-check.
      CRITICAL INSTRUCTIONS:
      1. Analyze the exact visual state of the food from the provided image.
      2. You MUST explicitly describe what you see in the image inside your "reason".
      3. Base safety on realistic FDA time-temperature principles. If the food appears fresh, intact, and well-maintained, mark it as SAFE. Only use UNSAFE for clear signs of spoilage or severe risk.
      4. Output MUST be ONLY valid JSON, with NO markdown code blocks.
      
      OUTPUT SCHEMA:
      { 
        "food": "Exact identified food name", 
        "condition": "Specific visual condition (e.g., 'Fresh, intact', 'Slightly wilted')", 
        "safety": "SAFE|CAUTION|UNSAFE", 
        "urgency": "low|medium|high|critical", 
        "reason": "Precise food-science justification based on visuals. Describe the image explicitly." 
      }`;
      
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
