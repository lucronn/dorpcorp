const fs = require('fs');
let code = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf8');

code = code.replace(
`  const updateCelestial3DMeshes = () => {`,
`  const updateCelestial3DMeshes = () => {
    try {`
);

code = code.replace(
`    // Dynamically calculate the spacetime fabric distortion based on gravity wells of active celestial bodies
  const getSpacetimeFabricDistortion = (`,
`    } catch (err) {
      console.error("[DEBUG] Error in updateCelestial3DMeshes:", err);
    }
  };

  // Dynamically calculate the spacetime fabric distortion based on gravity wells of active celestial bodies
  const getSpacetimeFabricDistortion = (`
);

// Fix the extra `};`
code = code.replace(
`        }
      });
    }
  };

    } catch (err) {`,
`        }
      });
    }

    } catch (err) {`
);


fs.writeFileSync('src/components/ParticleCanvas.tsx', code);
