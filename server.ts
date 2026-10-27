import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Procedural Fallback Cosmic System Generator
export function getProceduralFallbackSystem(requestedArchetype?: string) {
  const archetypes = [
    "BLACKHOLE_CENTRIC",
    "BINARY_PLANETS",
    "NEBULA_CRADLE",
    "EXOPLANET_CLUSTER",
    "SPIRAL_GALAXY",
    "STELLAR_PULSAR",
  ];
  const chosenArchetype =
    requestedArchetype && archetypes.includes(requestedArchetype)
      ? requestedArchetype
      : archetypes[Math.floor(Math.random() * archetypes.length)] || "BLACKHOLE_CENTRIC";

  const prefixes = ["Aethel", "Vespera", "Helios", "Kalypsos", "Zephyrus", "Hyperion", "Thalassa", "Kronos", "Astraea", "Celestia", "Elysium", "Nebulon", "Xenon"];
  const suffixes = ["Prime", "Resonance", "Anomalous", "Cradle", "Filament", "Spire", "Vortex", "Horizon", "Singularity", "Nursery", "Barycenter", "Clusters", "Borealis"];
  const systemName = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}-${Math.floor(Math.random() * 90 + 10)}`;

  let systemDesc = "";
  let systemTags: string[] = [];
  const entities: any[] = [];

  const hexColors = ["#ffffff", "#ffccaa", "#aaccff", "#ffddbb", "#cc8844", "#88bbff", "#aa4422", "#44aa44", "#cccccc"];
  const randomColor = () => hexColors[Math.floor(Math.random() * hexColors.length)];

  if (chosenArchetype === "BLACKHOLE_CENTRIC") {
    systemDesc = `A highly unstable gravitational pocket dominated by a spinning Kerr black hole. Relativistic lensing bends the luminescent light from twin surrounding diamond exoplanets into warped Einstein rings.`;
    systemTags = ["🕳 KERR SINGULARITY", "☄ RELATIVISTIC LENS", "★ ACCRETION PULSE"];
    
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
    systemDesc = `An ethereal, multicolored stellar nursery of ionized hydrogen gas and cosmic dust. Intense stellar winds from newly formed hypergiants sculpt majestic glowing hollows and dense protostellar cores.`;
    systemTags = ["☁ COSMIC NURSERY", "★ STELLAR WIND", "⚛ HYDROGEN CLOUD"];

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
    systemDesc = `A rare, perfectly resonant chain of crystalline planets sharing a stable orbit. Silicate rich sands on their surfaces reflect the brilliant golden radiation of their host hypergiant star.`;
    systemTags = ["💎 SILICATE DUNE", "☀ RESONANT CHAINS", "★ GOLDEN STAR"];

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
  } else if (chosenArchetype === "STELLAR_PULSAR") {
    systemDesc = `A hyper-dense relativistic magnetar spinning at hundreds of rotations per second. Collimated synchrotron beams and intense magnetic reconnection flares illuminate a diamond-rich remnant planet.`;
    systemTags = ["★ MAGNETAR", "⚡ RELATIVISTIC BEAMS", "💎 DIAMOND PLANET"];

    entities.push({
      type: "star",
      radius: Math.floor(Math.random() * 8 + 22),
      color: "#ffffff",
      secondaryColor: "#00ffd2",
    });
    entities.push({
      type: "planet",
      radius: Math.floor(Math.random() * 8 + 16),
      color: "#4deeea",
      secondaryColor: "#a5f3fc",
      hasRings: true,
      ringColor: "rgba(77, 238, 234, 0.4)",
    });
  } else {
    systemDesc = `A spectacular galactic arm composed of countless blue giant stars, swirling dust filaments, and intense interstellar radiation fields centered around an ultra-dense stellar core.`;
    systemTags = ["🌀 GALACTIC FILAMENT", "★ SWIRLING SHADOW", "☄ COLD DUST"];

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

export async function startServer(portOverride?: number) {
  const app = express();
  const envPort = process.env.PORT !== undefined ? Number(process.env.PORT) : NaN;
  const PORT =
    portOverride !== undefined
      ? portOverride
      : (!isNaN(envPort) && envPort >= 0 ? envPort : 8080);

  app.use(express.json());
  app.use(express.text({ type: "text/plain" }));

  // JSON Body-parser & API Error Handling Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (req.path.startsWith("/api/")) {
      return res.status(err?.status || 500).json({ error: err?.message || "Internal server error" });
    }
    next(err);
  });

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

  // Health check endpoints for Docker / Cloud Run / Kubernetes probes
  app.get(["/health", "/api/health"], (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: "healthy",
      service: "curtis-click-portfolio",
      environment: process.env.NODE_ENV || "development",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryUsage: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
      },
    });
  });

  // Client error logging endpoint with size bounding and string sanitization
  app.post("/api/log-error", (req, res) => {
    let rawError = typeof req.body === "string" ? req.body : req.body?.error;
    if (typeof rawError !== "string" && rawError !== undefined && rawError !== null) {
      try {
        rawError = JSON.stringify(rawError);
      } catch {
        rawError = String(rawError);
      }
    }
    const sanitizedError =
      typeof rawError === "string"
        ? rawError.slice(0, 500).replace(/[\r\n]+/g, " ")
        : "Unknown error";

    console.log("CLIENT ERROR:", sanitizedError);
    try {
      const logFile = path.resolve(process.cwd(), "client_errors.log");
      const maxLogBytes = 1024 * 1024; // 1MB threshold

      // Check file size and truncate/rotate if oversized to prevent unbounded disk growth
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > maxLogBytes) {
          const content = fs.readFileSync(logFile, "utf-8");
          const lines = content.split("\n");
          const preservedLines = lines.slice(-250).join("\n");
          fs.writeFileSync(logFile, preservedLines + "\n");
        }
      }

      fs.appendFileSync(logFile, `${new Date().toISOString()}: ${sanitizedError}\n`);
    } catch (e) {
      console.error("Failed to append to client_errors.log:", e);
    }
    res.json({ ok: true });
  });

  app.post("/api/generate-cosmic-scene", async (req, res) => {
    const requestedArchetype =
      typeof req.body?.archetype === "string" ? req.body.archetype : undefined;
    try {
      const client = getAIClient();
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const userPrompt =
        typeof req.body?.prompt === "string" && req.body.prompt.trim()
          ? ` User requested theme: "${req.body.prompt.trim().slice(0, 200)}".`
          : "";
      const archetypeHint = requestedArchetype
        ? ` Preferred archetype: ${requestedArchetype}.`
        : "";
      const response = await client.models.generateContent({
        model,
        contents: `Generate a completely unique, highly imaginative, custom cosmic system.${userPrompt}${archetypeHint} Focus on realistic, high-fidelity space objects, avoiding plain neon colors.`,
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
                description: "Select most fitting category: 'BLACKHOLE_CENTRIC', 'SPIRAL_GALAXY', 'STELLAR_PULSAR', 'BINARY_PLANETS', 'EXOPLANET_CLUSTER', 'NEBULA_CRADLE'"
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
      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }
      const data = JSON.parse(cleanText);
      const validArchetypes = [
        "BLACKHOLE_CENTRIC",
        "BINARY_PLANETS",
        "NEBULA_CRADLE",
        "EXOPLANET_CLUSTER",
        "SPIRAL_GALAXY",
        "STELLAR_PULSAR",
      ];
      if (!data.archetype || !validArchetypes.includes(data.archetype)) {
        data.archetype = (requestedArchetype && validArchetypes.includes(requestedArchetype))
          ? requestedArchetype
          : "BLACKHOLE_CENTRIC";
      }
      res.json(data);
    } catch (err: any) {
      // If we hit a rate limit or other error, fallback quietly without a scary stack trace
      console.log(`[Cosmic Engine] Using procedural fallback system (${err?.status === 429 ? 'Rate Limited' : 'API Unavailable'})`);
      const fallbackData = getProceduralFallbackSystem(requestedArchetype);
      res.json(fallbackData);
    }
  });

  // 404 handler for unrecognized /api routes to prevent returning SPA index.html
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    // Resilient static dist directory resolution with fallbacks
    const candidatePaths = [
      path.join(process.cwd(), "dist"),
      __dirname,
      path.resolve(__dirname, "..", "dist"),
    ];
    const distPath =
      candidatePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) || candidatePaths[0]!;

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send("Application assets unavailable. Run 'npm run build' first.");
      }
    });
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    const onError = (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n❌ [Server Error] Port ${PORT} is already in use by another process.`);
        console.error(`   You can specify an alternate port via the PORT environment variable:`);
        console.error(`   Example: PORT=3000 npm run dev  (or PORT=3000 npm start)\n`);
      } else {
        console.error(`\n❌ [Server Error] Failed to bind HTTP server to 0.0.0.0:${PORT}:`, err);
      }
      reject(err);
    };

    server.once("error", onError);
    server.listen(PORT, "0.0.0.0", () => {
      server.removeListener("error", onError);
      resolve();
    });
  });

  const boundAddress = server.address();
  const actualPort = typeof boundAddress === "object" && boundAddress ? boundAddress.port : PORT;
  console.log(`Server running on http://localhost:${actualPort}`);

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  const sigtermHandler = () => shutdown("SIGTERM");
  const sigintHandler = () => shutdown("SIGINT");

  process.on("SIGTERM", sigtermHandler);
  process.on("SIGINT", sigintHandler);

  server.once("close", () => {
    process.removeListener("SIGTERM", sigtermHandler);
    process.removeListener("SIGINT", sigintHandler);
  });

  return { app, server };
}

// Auto-start when executed directly as application entrypoint
const isDirectRun = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith("server.ts") ||
      process.argv[1].endsWith("server.cjs") ||
      process.argv[1].endsWith("server.js"))
);

if (isDirectRun && process.env.NODE_ENV !== "test") {
  startServer().catch((_err) => {
    process.exit(1);
  });
}
