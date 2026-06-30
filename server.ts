import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Safe client-side lazy-initialization block to guard against startup crashes if key is missing
  let ai: GoogleGenAI | null = null;
  function getAIClient(): GoogleGenAI {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return ai;
  }

  // API endpoint to generate cosmic scene
  app.post("/api/generate-cosmic-scene", async (req, res) => {
    try {
      const client = getAIClient();
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Generate a completely unique, highly imaginative, custom cosmic system. It could be centered around an exotic black hole, binary stars, twin planets, celestial nurseries, or crystal exoplanets.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              systemName: {
                type: Type.STRING,
                description: "Name of the unique stellar/cosmic system"
              },
              systemDesc: {
                type: Type.STRING,
                description: "Vivid, story-driven description of this specific region of space-time and its physical anomalies"
              },
              systemTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 highly distinctive tags representing system anomalies, e.g., '🕳 SINGULARITY', '★ COSMIC WEB'"
              },
              archetype: {
                type: Type.STRING,
                description: "Select most fitting category: 'BLACKHOLE_CENTRIC', 'BINARY_PLANETS', 'NEBULA_CRADLE', 'EXOPLANET_CLUSTER'"
              },
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: "Type of entity: 'blackhole', 'planet', 'nebula'"
                    },
                    radius: {
                      type: Type.NUMBER,
                      description: "Size in radius. For blackhole use 40 to 80, for planet use 15 to 45, for nebula use 200 to 400"
                    },
                    color: {
                      type: Type.STRING,
                      description: "Hex color representing the entity's visual palette (e.g. #00ffd2, #ffd778, #ff6600, etc.)"
                    },
                    secondaryColor: {
                      type: Type.STRING,
                      description: "Hex color for secondary shading or textures"
                    },
                    hasRings: {
                      type: Type.BOOLEAN,
                      description: "Whether the planet has striated rings (only relevant if type is planet)"
                    },
                    ringColor: {
                      type: Type.STRING,
                      description: "rgba string color for the rings (e.g., rgba(77, 238, 234, 0.4))"
                    }
                  },
                  required: ["type", "radius", "color"]
                }
              }
            },
            required: ["systemName", "systemDesc", "systemTags", "archetype", "entities"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No text returned from Gemini API");
      }
      const data = JSON.parse(text.trim());
      res.json(data);
    } catch (err: any) {
      console.error("Gemini scene generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate cosmic scene" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
