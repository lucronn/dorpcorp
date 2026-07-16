const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`      celestialGroupRef.current.getChildMeshes(false).forEach((child) => {
        if (child.material && child.material instanceof BABYLON.StandardMaterial) {
          const mat = child.material;
          if (child.name === "event_horizon_core") {
            mat.needDepthBufferWrite = true;
            mat.alpha = isInterstellarRef.current ? 1.0 : targetGroupOpacity;
            return;
          }

          if (!mat.metadata) {
            mat.metadata = { baseOpacity: mat.alpha ?? 1.0, fadeIn: 0.01 };
          }
          if (mat.metadata.fadeIn < 1.0) {
            mat.metadata.fadeIn += 0.06; // smoothly fade in over ~16 frames
            if (mat.metadata.fadeIn > 1.0) mat.metadata.fadeIn = 1.0;
          }
          const baseOpacity = mat.metadata.baseOpacity * mat.metadata.fadeIn;
          const musicPulseOpacity = 0.38 * musicAmp;
          mat.alpha = baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
        }
      });
    }
  };`,
`      celestialGroupRef.current.getChildMeshes(false).forEach((child) => {
        if (child.material && child.material instanceof BABYLON.StandardMaterial) {
          const mat = child.material;
          if (child.name === "event_horizon_core") {
            mat.needDepthBufferWrite = true;
            mat.alpha = isInterstellarRef.current ? 1.0 : targetGroupOpacity;
            return;
          }

          if (!mat.metadata) {
            mat.metadata = { baseOpacity: mat.alpha ?? 1.0, fadeIn: 0.01 };
          }
          if (mat.metadata.fadeIn < 1.0) {
            mat.metadata.fadeIn += 0.06; // smoothly fade in over ~16 frames
            if (mat.metadata.fadeIn > 1.0) mat.metadata.fadeIn = 1.0;
          }
          const baseOpacity = mat.metadata.baseOpacity * mat.metadata.fadeIn;
          const musicPulseOpacity = 0.38 * musicAmp;
          mat.alpha = baseOpacity * (targetGroupOpacity + musicPulseOpacity * (1 - targetGroupOpacity));
        }
      });
    }
    } catch (err) {
      console.error("[DEBUG] Error in updateCelestial3DMeshes:", err);
    }
  };`
);

fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
