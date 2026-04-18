import { GoogleGenerativeAI } from "@google/generative-ai";

async function testWithAQ() {
  const apiKey = "AQ.Ab8RN6Il6U9VmuwjbqqyQ0r1UXEHnybTWiWB5ehLvXCrcuMmVA";
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-flash-latest"; 
  
  console.log(`Testing with model: ${modelName} and AQ key`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hi");
    const response = await result.response;
    console.log("Success:", response.text());
  } catch (error) {
    console.error("Failed:", error.message);
  }
}

testWithAQ();
