const fs = require('fs');
const content = fs.readFileSync('src/components/ParticleCanvas.tsx', 'utf-8');

const replacement = `
          const entitiesToGen = geminiData ? geminiData.entities : Array(5).fill({});
          entitiesToGen.forEach((ent: any, i: number) => {
`;

const newCode = `
          if (geminiData && typeof registerAndSaveSequence === "function") {
              registerAndSaveSequence(geminiData.systemName, geminiData.systemDesc, geminiData.systemTags, geminiData.entities);
          } else if (geminiData && onSequenceGenerated) {
              onSequenceGenerated({
                  name: geminiData.systemName,
                  description: geminiData.systemDesc,
                  tags: geminiData.systemTags
              });
          }
          const entitiesToGen = geminiData ? geminiData.entities : Array(5).fill({});
          entitiesToGen.forEach((ent: any, i: number) => {
`;

const updatedContent = content.replace(replacement, newCode);
fs.writeFileSync('src/components/ParticleCanvas.tsx', updatedContent);
console.log("Updated UI logic.");
