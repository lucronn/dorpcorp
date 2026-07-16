const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetFuncStart = `    const startWormholeTransit = async () => {`;
const repFuncStart = `    const startWormholeTransit = async (targetPos?: BABYLON.Vector3, viewDir?: BABYLON.Vector3) => {`;

const targetAnim = `      const origCameraPos = camera.position.clone();
      BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, new BABYLON.Vector3(0, 0, 1000), 0, new BABYLON.QuadraticEase());`;

const repAnim = `      const origCameraPos = camera.position.clone();
      const flyDestination = targetPos || new BABYLON.Vector3(0, 0, 1000);
      BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, flyDestination, 0, new BABYLON.QuadraticEase());`;

const targetTunnel = `      // Generate Tube (Transit Tunnel)
      const path = [];
      for (let i = 0; i < 60; i++) {
          path.push(new BABYLON.Vector3(0, 0, -1000 + i * 50));
      }
      tunnelMesh = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path: path, radius: 40, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);`;

const repTunnel = `      // Generate Tube (Transit Tunnel) aligned to view direction
      const path = [];
      const dir = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
      // Place tunnel starting a bit ahead of camera's original pos, extending along dir
      for (let i = 0; i < 60; i++) {
          path.push(origCameraPos.add(dir.scale(i * 50)));
      }
      tunnelMesh = BABYLON.MeshBuilder.CreateTube("wormhole_tunnel", { path: path, radius: 40, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);`;

const targetObjects = `      for (let i = 0; i < 20; i++) {
          let mesh = i % 2 === 0 ? BABYLON.MeshBuilder.CreateTorusKnot("tk" + i, {radius: 2, tube: 0.5}, scene) : BABYLON.MeshBuilder.CreatePolyhedron("ph" + i, {type: 2, size: 3}, scene);
          mesh.position = new BABYLON.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, Math.random() * 1000 + 100);`;

const repObjects = `      const dirForObjs = viewDir ? viewDir.normalize() : new BABYLON.Vector3(0, 0, 1);
      for (let i = 0; i < 20; i++) {
          let mesh = i % 2 === 0 ? BABYLON.MeshBuilder.CreateTorusKnot("tk" + i, {radius: 2, tube: 0.5}, scene) : BABYLON.MeshBuilder.CreatePolyhedron("ph" + i, {type: 2, size: 3}, scene);
          // Distribute along the tunnel direction
          const forwardOffset = Math.random() * 1000 + 100;
          const radialOffset = new BABYLON.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0);
          mesh.position = origCameraPos.add(dirForObjs.scale(forwardOffset)).add(radialOffset);`;

const targetUpdate = `            flyingObjects.forEach(m => {
                m.position.z -= 5;
                m.rotation.x += 0.05;
                m.rotation.y += 0.05;
            });`;

const repUpdate = `            flyingObjects.forEach(m => {
                const moveDir = tunnelMesh && tunnelMesh.metadata && tunnelMesh.metadata.dir ? tunnelMesh.metadata.dir : new BABYLON.Vector3(0, 0, 1);
                m.position.subtractInPlace(moveDir.scale(5));
                m.rotation.x += 0.05;
                m.rotation.y += 0.05;
            });`;

content = content.replace(targetFuncStart, repFuncStart);
content = content.replace(targetAnim, repAnim);
content = content.replace(targetTunnel, repTunnel + '\\n      tunnelMesh.metadata = { dir: dir };');
content = content.replace(targetObjects, repObjects);
content = content.replace(targetUpdate, repUpdate);

const targetPointer = `            if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh && pointerInfo.pickInfo.pickedMesh.name.startsWith("pbr_planet")) {
                // Handled by ActionManager
                return;
            }
            startWormholeTransit();`;

const repPointer = `            if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh && pointerInfo.pickInfo.pickedMesh.name.startsWith("pbr_planet")) {
                // Handled by ActionManager
                return;
            }
            if (camera) {
                const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
                const targetPoint = ray.origin.add(ray.direction.scale(1500));
                startWormholeTransit(targetPoint, ray.direction);
            } else {
                startWormholeTransit();
            }`;

content = content.replace(targetPointer, repPointer);

fs.writeFileSync(file, content);
