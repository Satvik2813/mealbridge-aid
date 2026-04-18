async function testWithHeader() {
  const apiKey = "AIzaSyBBkbEyPR4RMbCO12WZCrU1k2T3pvZKx3E";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  
  console.log(`Testing first key with Header...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(error);
  }
}

testWithHeader();
