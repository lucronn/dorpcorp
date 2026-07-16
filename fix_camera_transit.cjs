const fs = require('fs');
const file = 'src/components/ParticleCanvas.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `      // Animate FOV to widen
      BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 2.5, 0 /* loop */, new BABYLON.QuadraticEase());`;

const rep1 = `      // Animate FOV to widen
      BABYLON.Animation.CreateAndStartAnimation("fovAnim", camera, "fov", 60, 60, camera.fov, 2.5, 0 /* loop */, new BABYLON.QuadraticEase());
      const origCameraPos = camera.position.clone();
      BABYLON.Animation.CreateAndStartAnimation("camTransitAnim", camera, "position", 60, 180, origCameraPos, new BABYLON.Vector3(0, 0, 1000), 0, new BABYLON.QuadraticEase());`;

const target2 = `          // Decelerate camera & restore FOV
          BABYLON.Animation.CreateAndStartAnimation("fovAnimRest", camera, "fov", 60, 60, camera.fov, fovRef.current * Math.PI / 180 || 1.0, 0, new BABYLON.QuadraticEase());`;

const rep2 = `          // Decelerate camera & restore FOV
          BABYLON.Animation.CreateAndStartAnimation("fovAnimRest", camera, "fov", 60, 60, camera.fov, fovRef.current * Math.PI / 180 || 1.0, 0, new BABYLON.QuadraticEase());
          BABYLON.Animation.CreateAndStartAnimation("camRestAnim", camera, "position", 60, 60, camera.position, new BABYLON.Vector3(0, 0, -cameraZRef.current), 0, new BABYLON.QuadraticEase());`;

content = content.replace(target1, rep1);
content = content.replace(target2, rep2);

fs.writeFileSync(file, content);
