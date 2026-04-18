import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { items, category, cookedAt, base64Image, mode = "urgency" } = body;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("Critical: GEMINI_API_KEY environment variable is missing.");
      return new Response(JSON.stringify({ 
        error: "Server configuration error: GEMINI_API_KEY missing.",
        tip: "Set GEMINI_API_KEY using 'supabase secrets set GEMINI_API_KEY=xxx'" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    let prompt = "";
    if (mode === "urgency") {
      if (!items || !Array.isArray(items)) {
        throw new Error("Missing or invalid 'items' in request body for urgency mode.");
      }
      const itemsText = items.map((it: any) => `- ${it.qty} ${it.unit} of ${it.name}`).join("\n");
      prompt = `You are an elite Food Safety Forensic Analyst.
      
      SUBMISSION:
      Category: ${category || "General"}
      Cooked at: ${cookedAt || "Unknown"}
      Items:
      ${itemsText}
      
      TASK: Provide a high-precision safety audit JSON.
      {
        "urgency": "low|medium|high|critical",
        "window": "Phrase",
        "reasoning": "Explanation",
        "feed_count": integer,
        "per_item_servings": { "Item": integer, ... },
        "storage_advice": "Instruction",
        "risks": ["Risk"],
        "safety_score": 0-100,
        "suggested_expiry": "ISO_STRING"
      }`;
    } else {
      prompt = `Direct food safety item check. Analyze the food condition and safety. 
      JSON Output: { "food": "name", "condition": "state", "safety": "SAFE|CAUTION|UNSAFE", "urgency": "level", "reason": "why" }`;
    }

    const parts: any[] = [prompt];
    if (base64Image) {
      parts.push({
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();
    const clean = text.replace(/```json|```/g, "").trim();

    return new Response(clean, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
