const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

// We want to add startWormholeTransit inside the useEffect around line 4560, before `return () => {`
const lines = content.split('\n');

const useEffectCleanupIdx = lines.findIndex((l, i) => i > 4500 && l.includes('return () => {'));
if (useEffectCleanupIdx === -1) {
    console.error("Could not find return () => { in useEffect");
    process.exit(1);
}

const wormholeLogic = `
    // --- WORMHOLE TRANSIT LOGIC ---
    let isTransitActive = false;
    let tunnelMesh: BABYLON.Mesh | null = null;
    let tunnelMaterial: BABYLON.ShaderMaterial | null = null;
    let flyingObjects: BABYLON.Mesh[] = [];
    let pbrPlanets: BABYLON.Mesh[] = [];
    let pbrStarLight: BABYLON.PointLight | null = null;
    let transitStartTime = 0;
    let transitCameraZ = 0;

    const startWormholeTransit = async () => {
      if (isTransitActive) return;
      isTransitActive = true;
      transitStartTime = Date.now();

      const engine = rendererRef.current;
      if (!scene || !camera || !engine) return;

      // Fetch next scene in background
      await fetchNextGeminiScene();
      const geminiData = nextGeminiSceneRef.current;

      // 1. Custom PostProcess: Radial blur & Chromatic Aberration
      BABYLON.Effect.ShadersStore["wormholeFragmentShader"] = \`
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float time;
        void main(void) {
            vec2 uv = vUV;
            vec2 dir = 0.5 - uv;
            float dist = length(dir);
            dir = normalize(dir);
            vec4 c = texture2D(textureSampler, uv);
            float blurAmount = sin(time * 2.0) * 0.05 + 0.05;
            vec4 sum = vec4(0.0);
            for (int i = 0; i < 10; i++) {
                sum += texture2D(textureSampler, uv + dir * (float(i) / 10.0) * blurAmount);
            }
            sum /= 10.0;
            // Chromatic aberration
            float ca = blurAmount * 0.5;
            sum.r = texture2D(textureSampler, uv + dir * ca).r;
            sum.b = texture2D(textureSampler, uv - dir * ca).b;
            gl_FragColor = sum;
        }
      \`;

      const wormholePostProcess = new BABYLON.PostProcess("WormholePP", "wormhole", ["time"], null, 1.0, camera);
      let ppTime = 0;
      wormholePostProcess.onApply = (effect) => {
          ppTime += 0.01;
          effect.setFloat("time", ppTime);
      };

      // Animate FOV to widen
      BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 2.5, 0 /* loop */, new BABYLON.QuadraticEase());

      // 2. Fade out existing meshes/particles
      scene.meshes.forEach(m => {
          if (m.name !== "hudPlane" && m.name !== "wormhole_tunnel") {
              if (m.material) {
                  m.material.alpha = 0; // simplistic fade for brevity, could animate
              }
              m.isVisible = false;
          }
      });

      // Generate Tube (Transit Tunnel)
      const path = [];
      for (let i = 0; i < 60; i++) {
          path.push(new BABYLON.Vector3(0, 0, i * 20));
      }
      tunnelMesh = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path: path, radius: 40, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
      
      BABYLON.Effect.ShadersStore["tunnelVertexShader"] = \`
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 worldViewProjection;
        varying vec2 vUV;
        void main(void) {
            vUV = uv;
            gl_Position = worldViewProjection * vec4(position, 1.0);
        }
      \`;
      BABYLON.Effect.ShadersStore["tunnelFragmentShader"] = \`
        precision highp float;
        varying vec2 vUV;
        uniform float time;
        void main(void) {
            vec2 uv = vUV;
            float swirl = sin(uv.y * 10.0 + time) * 0.5 + 0.5;
            vec3 color = mix(vec3(0.1, 0.0, 0.4), vec3(0.0, 0.8, 1.0), swirl);
            gl_FragColor = vec4(color, 1.0);
        }
      \`;

      tunnelMaterial = new BABYLON.ShaderMaterial("tunnelMat", scene, {
          vertex: "tunnel",
          fragment: "tunnel",
      }, {
          attributes: ["position", "uv"],
          uniforms: ["worldViewProjection", "time"]
      });
      tunnelMesh.material = tunnelMaterial;

      // Populate with abstract geometries
      const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.dds", scene);
      
      for (let i = 0; i < 20; i++) {
          let mesh = i % 2 === 0 ? BABYLON.MeshBuilder.CreateTorusKnot("tk" + i, {radius: 2, tube: 0.5}, scene) : BABYLON.MeshBuilder.CreatePolyhedron("ph" + i, {type: 2, size: 3}, scene);
          mesh.position = new BABYLON.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, Math.random() * 1000 + 100);
          
          let pbr = new BABYLON.PBRMaterial("pbr" + i, scene);
          pbr.metallic = 1.0;
          pbr.roughness = 0.0;
          pbr.reflectionTexture = envTex;
          mesh.material = pbr;
          flyingObjects.push(mesh);
      }

      // 3. New Solar System (After 3 seconds)
      setTimeout(() => {
          // Decelerate camera & restore FOV
          BABYLON.Animation.CreateAndStartAnimation("fovAnimRest", camera, "fov", 60, 60, camera.fov, fovRef.current * Math.PI / 180 || 1.0, 0, new BABYLON.QuadraticEase());
          wormholePostProcess.dispose();
          if (tunnelMesh) tunnelMesh.dispose();
          flyingObjects.forEach(m => m.dispose());
          flyingObjects = [];

          // Generate Pristine Solar System
          const starGlow = new BABYLON.GlowLayer("starGlow", scene);
          starGlow.intensity = 2.0;

          pbrStarLight = new BABYLON.PointLight("starLight", new BABYLON.Vector3(0, 0, 0), scene);
          pbrStarLight.intensity = 10000;

          const starMesh = BABYLON.MeshBuilder.CreateSphere("pbr_star", {diameter: 40}, scene);
          const starMat = new BABYLON.PBRMaterial("starMat", scene);
          starMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.4);
          starMat.disableLighting = true;
          starMesh.material = starMat;
          pbrPlanets.push(starMesh);

          const entitiesToGen = geminiData ? geminiData.entities : Array(5).fill({});
          entitiesToGen.forEach((ent: any, i: number) => {
              if (ent.type === "blackhole") return;
              const orbitRadius = 80 + i * 40;
              const angle = Math.random() * Math.PI * 2;
              const planet = BABYLON.MeshBuilder.CreateSphere("pbr_planet_" + i, {diameter: 10 + Math.random() * 10}, scene);
              planet.position = new BABYLON.Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
              
              const planetMat = new BABYLON.PBRMaterial("planetMat_" + i, scene);
              planetMat.metallic = Math.random();
              planetMat.roughness = Math.random();
              planetMat.albedoColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
              planet.material = planetMat;
              pbrPlanets.push(planet);

              // 4. ActionManager for Planetary Flyby
              planet.actionManager = new BABYLON.ActionManager(scene);
              planet.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                  triggerPlanetaryFlyby(planet);
              }));
          });

          isTransitActive = false;
      }, 3000);
    };

    const triggerPlanetaryFlyby = (targetMesh: BABYLON.Mesh) => {
        if (!camera) return;
        const targetPos = targetMesh.position;
        // Cinematic flyby: animate camera to a point near the planet
        const offset = new BABYLON.Vector3(20, 10, 20);
        const flyToPos = targetPos.add(offset);
        
        BABYLON.Animation.CreateAndStartAnimation("camFly", camera, "position", 60, 120, camera.position, flyToPos, 0, new BABYLON.CubicEase());
        BABYLON.Animation.CreateAndStartAnimation("camTarget", camera, "target", 60, 120, camera.getTarget(), targetPos, 0, new BABYLON.CubicEase());
    };

    scene.onBeforeRenderObservable.add(() => {
        if (isTransitActive && tunnelMaterial) {
            tunnelMaterial.setFloat("time", (Date.now() - transitStartTime) * 0.005);
            flyingObjects.forEach(m => {
                m.position.z -= 5;
                m.rotation.x += 0.05;
                m.rotation.y += 0.05;
                if (m.position.z < 0) {
                    m.position.z = 1000;
                }
            });
        }
        // Very basic rotation for PBR planets
        if (!isTransitActive && pbrPlanets.length > 1) {
            for (let i = 1; i < pbrPlanets.length; i++) {
                const p = pbrPlanets[i];
                p.position.x = p.position.x * Math.cos(0.001) - p.position.z * Math.sin(0.001);
                p.position.z = p.position.x * Math.sin(0.001) + p.position.z * Math.cos(0.001);
                p.rotation.y += 0.01;
            }
        }
    });

    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh && pointerInfo.pickInfo.pickedMesh.name.startsWith("pbr_planet")) {
                // Handled by ActionManager
                return;
            }
            startWormholeTransit();
        }
    });
`;

lines.splice(useEffectCleanupIdx, 0, wormholeLogic);
fs.writeFileSync('src/components/ParticleCanvas.tsx', lines.join('\n'));
console.log("Injected logic.");
