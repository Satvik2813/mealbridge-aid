import { OpenRouter } from "@openrouter/sdk";

const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;

if (!apiKey) {
  console.warn("VITE_OPENROUTER_API_KEY is not set. AI features may not work.");
}

export const openrouter = new OpenRouter({
  apiKey,
});
