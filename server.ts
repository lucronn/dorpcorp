import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
    const archetypes = [
      "BLACKHOLE_CENTRIC",
      "KILONOVA_MERGER",
      "RELATIVISTIC_BLAZAR",
      "BINARY_PLANETS",
      "NEBULA_CRADLE",
      "EXOPLANET_CLUSTER",
      "SPIRAL_GALAXY"
    ];
    const chosenArchetype = archetypes[Math.floor(Math.random() * archetypes.length)] || "BLACKHOLE_CENTRIC";

    const prefixes = ["Aethel", "Vespera", "Helios", "Kalypsos", "Zephyrus", "Hyperion", "Thalassa", "Kronos", "Astraea", "Celestia", "Elysium", "Nebulon", "Xenon"];
    const suffixes = ["Prime", "Resonance", "Anomalous", "Cradle", "Filament", "Spire", "Vortex", "Horizon", "Singularity", "Nursery", "Barycenter", "Clusters", "Borealis"];
    const systemName = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}-${Math.floor(Math.random() * 90 + 10)}`;

    let systemDesc = "";
    let systemTags: string[] = [];
    const entities: any[] = [];

    const hexColors = ["#ffffff", "#ffccaa", "#aaccff", "#ffddbb", "#cc8844", "#88bbff", "#aa4422", "#44aa44", "#cccccc"];
    const randomColor = () => hexColors[Math.floor(Math.random() * hexColors.length)];

    if (chosenArchetype === "BLACKHOLE_CENTRIC") {
      systemDesc = `A spinning Kerr black hole surrounded by a geometrically thin accretion disk and an inner frame-dragged ergosphere. Strong-field null-geodesic bending generates primary and secondary Einstein rings with Doppler-boosted flux asymmetry.`;
      systemTags = ["🕳 KERR ERGOSPHERE", "☄ NULL GEODESICS", "★ DOPPLER BEAMING"];
      
      entities.push({
        type: "blackhole",
        radius: Math.floor(Math.random() * 20 + 55),
        color: "#ff8844",
        secondaryColor: "#ff4422"
      });
      const count = Math.floor(Math.random() * 2 + 1);
      for (let i = 0; i < count; i++) {
        entities.push({
          type: "planet",
          radius: Math.floor(Math.random() * 15 + 15),
          color: randomColor(),
          secondaryColor: randomColor(),
          hasRings: Math.random() > 0.4,
          ringColor: "rgba(200, 200, 200, 0.4)"
        });
      }
      entities.push({
        type: "star",
        radius: Math.floor(Math.random() * 10 + 20),
        color: "#ffffff",
        secondaryColor: "#aaccff"
      });
    } else if (chosenArchetype === "BINARY_PLANETS") {
      systemDesc = `Two gravitationally bound planets in mutual orbit about their common barycenter. Hydrodynamic mass transfer occurs via Roche-lobe overflow through the inner L1 Lagrange point, producing an ionized atmospheric stream.`;
      systemTags = ["☄ BARYCENTER ORBIT", "⚡ ROCHE-LOBE L1", "★ TIDAL STREAM"];

      entities.push({
        type: "star",
        radius: Math.floor(Math.random() * 15 + 40),
        color: randomColor(),
        secondaryColor: randomColor()
      });
      entities.push({
        type: "planet",
        radius: 30,
        color: "#2255aa",
        secondaryColor: "#44aa44",
        hasRings: true,
        ringColor: "rgba(220, 220, 220, 0.35)"
      });
      entities.push({
        type: "planet",
        radius: 26,
        color: "#cc8844",
        secondaryColor: "#aa4422",
        hasRings: false
      });
    } else if (chosenArchetype === "NEBULA_CRADLE") {
      systemDesc = `An interstellar H II region of photoionized atomic hydrogen and silicate dust. Stellar radiation pressure from massive O/B stars carves ionized shock fronts around dense protostellar Bok globules.`;
      systemTags = ["☁ H II REGION", "★ BOK GLOBULES", "⚛ PHOTOIONIZATION"];

      entities.push({
        type: "nebula",
        radius: Math.floor(Math.random() * 100 + 250),
        color: "#ff4466",
        secondaryColor: "#4488ff"
      });
      entities.push({
        type: "star",
        radius: 35,
        color: "#aaccff",
        secondaryColor: "#ffffff"
      });
      entities.push({
        type: "planet",
        radius: 22,
        color: "#ffddbb",
        secondaryColor: "#cc8844",
        hasRings: true,
        ringColor: "rgba(255, 255, 255, 0.45)"
      });
    } else if (chosenArchetype === "EXOPLANET_CLUSTER") {
      systemDesc = `A compact multi-planet system locked in a 3-body Laplace orbital resonance chain around an M-dwarf host star. Nested Keplerian semi-major axes create stable commensurabilities and periodic transit timing variations.`;
      systemTags = ["🪐 LAPLACE CHAIN", "☀ M-DWARF HOST", "★ TTV RESONANCE"];

      entities.push({
        type: "star",
        radius: 50,
        color: "#ffccaa",
        secondaryColor: "#ffddbb"
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
    } else if (chosenArchetype === "KILONOVA_MERGER") {
      systemDesc = `A binary neutron star coalescence emitting high-frequency gravitational-wave chirps, launching radioactive r-process ejecta that synthesize heavy elements like gold and platinum.`;
      systemTags = ["💫 GW INSPIRAL", "⚛ r-PROCESS GOLD", "⚡ KILONOVA FIREBALL"];

      entities.push({
        type: "star",
        radius: 20,
        color: "#e0f2fe",
        secondaryColor: "#38bdf8"
      });
      entities.push({
        type: "star",
        radius: 18,
        color: "#fdf4ff",
        secondaryColor: "#c084fc"
      });
      entities.push({
        type: "nebula",
        radius: 340,
        color: "rgba(255, 185, 80, 0.22)",
        secondaryColor: "rgba(168, 85, 247, 0.18)"
      });
    } else if (chosenArchetype === "RELATIVISTIC_BLAZAR") {
      systemDesc = `A 6.5-billion-solar-mass Kerr black hole powering a collimated relativistic jet showing apparent superluminal motion (β_app ≈ 6c) and polarized synchrotron shock knots.`;
      systemTags = ["⚡ SUPERLUMINAL (6c)", "🕳 SMBH SINGULARITY", "★ HST-1 SHOCK KNOT"];

      entities.push({
        type: "blackhole",
        radius: 54,
        color: "#ff7700",
        secondaryColor: "#ffffff"
      });
      entities.push({
        type: "star",
        radius: 16,
        color: "#ffffff",
        secondaryColor: "#38bdf8"
      });
      entities.push({
        type: "star",
        radius: 20,
        color: "#bae6fd",
        secondaryColor: "#0284c7"
      });
      entities.push({
        type: "nebula",
        radius: 360,
        color: "rgba(56, 189, 248, 0.16)",
        secondaryColor: "rgba(249, 115, 22, 0.14)"
      });
    } else {
      systemDesc = `A grand-design spiral galaxy stabilized by an extended NFW dark matter halo. Lin-Shu density waves compress giant molecular clouds into bright blue OB starburst clusters, sustaining a flat rotational velocity profile.`;
      systemTags = ["🌀 NFW HALO", "★ DENSITY WAVES", "☄ FLAT ROTATION"];

      entities.push({
        type: "star",
        radius: 38,
        color: "#aaccff",
        secondaryColor: "#ffffff"
      });
      entities.push({
        type: "nebula",
        radius: 300,
        color: "#4488ff",
        secondaryColor: "#ff4466"
      });
      entities.push({
        type: "planet",
        radius: 20,
        color: "#44aa44",
        secondaryColor: "#2255aa",
        hasRings: true,
        ringColor: "rgba(200, 200, 200, 0.3)"
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
        contents: "Generate a completely unique, custom cosmic system strictly grounded in genuine astrophysics and General Relativity. Incorporate realistic stellar spectral classes (O, B, A, F, G, K, M), Keplerian multi-body orbital dynamics, accretion disk thermodynamics, or relativistic null-geodesic lensing. Avoid theatrical sci-fi clichés, impossible co-orbital paradoxes, or neon fantasy tropes. Colors must reflect blackbody stellar temperatures, synchrotron continuum, or natural mineral compositions.",
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
                description: "Select most fitting category: 'BLACKHOLE_CENTRIC', 'KILONOVA_MERGER', 'RELATIVISTIC_BLAZAR', 'SPIRAL_GALAXY', 'STELLAR_PULSAR', 'BINARY_PLANETS', 'EXOPLANET_CLUSTER', 'NEBULA_CRADLE'"
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
                      description: "Realistic hex color representing the entity's visual palette (e.g., Earthly blue #2255aa, Gas giant orange #cc8844, Star white #ffffff, NOT neon colors)"
                    },
                    secondaryColor: {
                      type: Type.STRING,
                      description: "Hex color for secondary shading or textures (realistic, non-neon)"
                    },
                    hasRings: {
                      type: Type.BOOLEAN,
                      description: "Whether the planet has striated rings (only relevant if type is planet)"
                    },
                    ringColor: {
                      type: Type.STRING,
                      description: "rgba string color for the rings (e.g., rgba(200, 200, 200, 0.4))"
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
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
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
