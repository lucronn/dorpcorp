const { execSync } = require('child_process');
try {
    execSync('git checkout src/components/ParticleCanvas.tsx');
    console.log("File restored successfully from git!");
} catch (e) {
    console.error("Failed to restore from git:", e.message);
}
