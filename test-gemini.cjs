const { GoogleGenAI, Type } = require("@google/genai");
require("dotenv").config();

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: "Generate a completely unique, highly imaginative, custom cosmic system. It could be centered around an exotic black hole, binary stars, twin planets, celestial nurseries, or crystal exoplanets.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          systemName: { type: Type.STRING },
          systemDesc: { type: Type.STRING },
          systemTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          archetype: { type: Type.STRING },
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                radius: { type: Type.NUMBER },
                color: { type: Type.STRING },
              },
              required: ["type", "radius", "color"]
            }
          }
        },
        required: ["systemName", "systemDesc", "systemTags", "archetype", "entities"]
      }
    }
  });
  console.log(response.text);
}
run().catch(console.error);
