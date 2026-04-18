import { GoogleGenerativeAI } from "@google/generative-ai";

async function listAll() {
  const apiKey = "AIzaSyBBkbEyPR4RMbCO12WZCrU1k2T3pvZKx3E";
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch (error) {
    console.error(error);
  }
}

listAll();
