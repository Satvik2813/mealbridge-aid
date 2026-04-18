import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    imageFile?: File; // New optional image parameter
  }) => {
    setLoading(true);
    setReasoningText("");
    setResult(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setResult({
        urgency: "high",
        window: "4 hours",
        reasoning: "AI check unavailable. Defaulting to high urgency.",
        feed_count: food.items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0),
        per_item_servings: {},
        storage_advice: "Keep food covered.",
        risks: ["Safety window unknown without AI."],
        safety_score: 50,
      });
      setLoading(false);
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const itemsText = food.items
      .map((it) => `- ${it.qty} ${it.unit} of ${it.name}`)
      .join("\n");

    const minutesSinceCooked = Math.round(
      (Date.now() - new Date(food.cookedAt).getTime()) / 60000
    );

    const promptText = `You are an elite Food Safety Forensic Analyst.
    
    SUBMISSION FOR ANALYSIS:
    Category: ${food.category}
    Cooked at: ${food.cookedAt} (${minutesSinceCooked} minutes ago)
    Reported Items:
    ${itemsText}
    
    TASK: Provide a high-precision safety audit.
    1. VISUAL INSPECTION: If an image is provided, analyze the texture, moisture, and color. 
       Cross-reference visual state with the "Cooked at" time. If the food looks older than reported (e.g., dry edges on supposedly fresh rice), penalize the safety_score and reasoning.
    2. QUANTITY VERIFICATION: Verify if the "Reported Items" match the visual volume in the photo.
    3. EXPIRATION: Set "suggested_expiry" (ISO string) based on the "danger zone" (4 hours for hot food, 2 hours for room temp).
    
    EXPECTED JSON RESPONSE:
    {
      "urgency": "low|medium|high|critical",
      "window": "Short phrase like '2 hours remaining'",
      "reasoning": "Forensic explanation of safety based on type, age, and visual evidence.",
      "feed_count": <integer: estimated people>,
      "per_item_servings": { "Item Name": <integer>, ... },
      "storage_advice": "Critical storage instruction to maintain safety.",
      "risks": ["Specific threat like 'Bacillus cereus risk due to rice temperature'"],
      "safety_score": <integer 0-100>,
      "suggested_expiry": "ISO_STRING"
    }`;

    try {
      let parts: any[] = [promptText];

      if (food.imageFile) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(food.imageFile!);
        });
        
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: food.imageFile.type
          }
        });
      }

      // Simple retry logic for 503
      let attempt = 0;
      let lastError: any;
      
      while (attempt < 2) {
        try {
          const result = await model.generateContent(parts);
          const response = await result.response;
          const text = response.text();
          
          const clean = text.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(clean) as AIUrgencyResult;
          setResult(parsed);
          setReasoningText(parsed.reasoning || "");
          return; // Success
        } catch (e: any) {
          lastError = e;
          if (e.message?.includes("503") || e.status === 503) {
            attempt++;
            if (attempt < 2) {
              console.log("Gemini 503: High demand. Retrying in 2s...");
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
          }
          throw e; // Fail if not 503 or after retries
        }
      }
    } catch (err: any) {
      console.error("Gemini AI failed:", err);
      const is503 = err.message?.includes("503") || err.status === 503;
      
      setResult({
        urgency: "high",
        window: "4 hours",
        reasoning: is503 
          ? "AI engine is currently experiencing high demand. Please proceed with manual safety verification." 
          : "AI service error. Defaulting to safe values.",
        feed_count: 10,
        per_item_servings: {},
        storage_advice: "Refrigerate immediately.",
        risks: ["Analysis service busy. Verify manually."],
        safety_score: 50,
      });
    } finally {
      setLoading(false);
    }
  };

  return { calculateUrgency, loading, reasoningText, result };
}
