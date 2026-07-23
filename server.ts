import express from "express";
import path from "path";
import fs from "fs";
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

  // Procedural Fallback Cosmic System Generator
  function getProceduralFallbackSystem() {
    const archetypes = ["BLACKHOLE_CENTRIC", "BINARY_PLANETS", "NEBULA_CRADLE", "EXOPLANET_CLUSTER", "SPIRAL_GALAXY"];
    const chosenArchetype = archetypes[Math.floor(Math.random() * archetypes.length)] || "BLACKHOLE_CENTRIC";

    const prefixes = ["Aethel", "Vespera", "Helios", "Kalypsos", "Zephyrus", "Hyperion", "Thalassa", "Kronos", "Astraea", "Celestia", "Elysium", "Nebulon", "Xenon"];
    const suffixes = ["Prime", "Resonance", "Anomalous", "Cradle", "Filament", "Spire", "Vortex", "Horizon", "Singularity", "Nursery", "Barycenter", "Clusters", "Borealis"];
    const systemName = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}-${Math.floor(Math.random() * 90 + 10)}`;

    let systemDesc = "";
    let systemTags: string[] = [];
    const entities: any[] = [];

    const hexColors = ["#00ffd2", "#ff6600", "#ffdf00", "#00e5ff", "#ff007f", "#aa00ff", "#00ff99", "#ffe600", "#e100ff"];
    const randomColor = () => hexColors[Math.floor(Math.random() * hexColors.length)];

    if (chosenArchetype === "BLACKHOLE_CENTRIC") {
      systemDesc = `A highly unstable gravitational pocket dominated by a spinning Kerr black hole. Relativistic lensing bends the luminescent light from twin surrounding diamond exoplanets into warped Einstein rings.`;
      systemTags = ["🕳 KERR SINGULARITY", "☄ RELATIVISTIC LENS", "★ ACCRETION PULSE"];
      
      entities.push({
        type: "blackhole",
        radius: Math.floor(Math.random() * 20 + 55),
        color: "#ff5100",
        secondaryColor: "#ffa600"
      });
      const count = Math.floor(Math.random() * 2 + 1);
      for (let i = 0; i < count; i++) {
        entities.push({
          type: "planet",
          radius: Math.floor(Math.random() * 15 + 15),
          color: randomColor(),
          secondaryColor: randomColor(),
          hasRings: Math.random() > 0.4,
          ringColor: "rgba(0, 255, 210, 0.4)"
        });
      }
      entities.push({
        type: "star",
        radius: Math.floor(Math.random() * 10 + 20),
        color: "#ffffff",
        secondaryColor: "#00e5ff"
      });
    } else if (chosenArchetype === "BINARY_PLANETS") {
      systemDesc = `Two massive, twin planets tidally locked to one another, orbiting a common barycenter. Ionized particle winds bridge their upper atmospheres, generating a permanent bridge of glowing auroral light.`;
      systemTags = ["☄ TIDAL LOCK", "⚡ IONIC WIND", "★ BARYCENTER"];

      entities.push({
        type: "star",
        radius: Math.floor(Math.random() * 15 + 40),
        color: randomColor(),
        secondaryColor: randomColor()
      });
      entities.push({
        type: "planet",
        radius: 30,
        color: "#00ffd2",
        secondaryColor: "#0055ff",
        hasRings: true,
        ringColor: "rgba(0, 255, 210, 0.35)"
      });
      entities.push({
        type: "planet",
        radius: 26,
        color: "#ff007f",
        secondaryColor: "#aa00ff",
        hasRings: false
      });
    } else if (chosenArchetype === "NEBULA_CRADLE") {
      systemDesc = `An ethereal, multicolored stellar nursery of ionized hydrogen gas and cosmic dust. Intense stellar winds from newly formed hypergiants sculpt majestic glowing hollows and dense protostellar cores.`;
      systemTags = ["☁ COSMIC NURSERY", "★ STELLAR WIND", "⚛ HYDROGEN CLOUD"];

      entities.push({
        type: "nebula",
        radius: Math.floor(Math.random() * 100 + 250),
        color: "#aa00ff",
        secondaryColor: "#00ffd2"
      });
      entities.push({
        type: "star",
        radius: 35,
        color: "#00e5ff",
        secondaryColor: "#ffffff"
      });
      entities.push({
        type: "planet",
        radius: 22,
        color: "#ffdf00",
        secondaryColor: "#ff5100",
        hasRings: true,
        ringColor: "rgba(255, 223, 0, 0.45)"
      });
    } else if (chosenArchetype === "EXOPLANET_CLUSTER") {
      systemDesc = `A rare, perfectly resonant chain of crystalline planets sharing a stable orbit. Silicate rich sands on their surfaces reflect the brilliant golden radiation of their host hypergiant star.`;
      systemTags = ["💎 SILICATE DUNE", "☀ RESONANT CHAINS", "★ GOLDEN STAR"];

      entities.push({
        type: "star",
        radius: 50,
        color: "#ffa600",
        secondaryColor: "#ffe600"
      });
      const count = Math.floor(Math.random() * 2 + 2);
      for (let i = 0; i < count; i++) {
        entities.push({
          type: "planet",
          radius: Math.floor(Math.random() * 10 + 15),
          color: randomColor(),
          secondaryColor: randomColor(),
          hasRings: Math.random() > 0.5,
          ringColor: "rgba(255, 255, 255, 0.4)"
        });
      }
    } else {
      systemDesc = `A spectacular galactic arm composed of countless blue giant stars, swirling dust filaments, and intense interstellar radiation fields centered around an ultra-dense stellar core.`;
      systemTags = ["🌀 GALACTIC FILAMENT", "★ SWIRLING SHADOW", "☄ COLD DUST"];

      entities.push({
        type: "star",
        radius: 38,
        color: "#00e5ff",
        secondaryColor: "#ffffff"
      });
      entities.push({
        type: "nebula",
        radius: 300,
        color: "#0033ff",
        secondaryColor: "#ff00aa"
      });
      entities.push({
        type: "planet",
        radius: 20,
        color: "#00ff99",
        secondaryColor: "#008855",
        hasRings: true,
        ringColor: "rgba(0, 255, 153, 0.3)"
      });
    }

    return {
      systemName,
      systemDesc,
      systemTags,
      archetype: chosenArchetype,
      entities
    };
  }

  // API endpoint to generate cosmic scene
  app.post("/api/log-error", express.json(), (req, res) => {
    console.log("CLIENT ERROR:", req.body?.error);
    try {
      fs.appendFileSync('client_errors.log', new Date().toISOString() + ': ' + (req.body?.error || 'Unknown error') + '\n');
    } catch (e) {
      console.error("Failed to append to client_errors.log:", e);
    }
    res.json({ ok: true });
  });

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
                description: "Select most fitting category: 'BLACKHOLE_CENTRIC', 'BINARY_PLANETS', 'NEBULA_CRADLE', 'EXOPLANET_CLUSTER', 'SPIRAL_GALAXY'"
              },
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: "Type of entity: 'blackhole', 'planet', 'nebula', 'star'"
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
      // If we hit a rate limit or other error, fallback quietly without a scary stack trace
      console.log(`[Cosmic Engine] Using procedural fallback system (${err?.status === 429 ? 'Rate Limited' : 'API Unavailable'})`);
      const fallbackData = getProceduralFallbackSystem();
      res.json(fallbackData);
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
