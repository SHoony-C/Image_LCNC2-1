const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/msa4_vector_transform.vue');
const backupPath = filePath + '.backup-simple';

// Create backup
fs.copyFileSync(filePath, backupPath);
console.log('Created backup at:', backupPath);

// Read file as lines
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find problematic line(s)
let problematicLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '</style>' && i > 0 && lines[i-1].trim().endsWith('}')) {
    problematicLines.push(i);
  }
}

console.log('Found potential problematic lines:', problematicLines);

// Keep only the first style closing tag, remove others
if (problematicLines.length > 1) {
  console.log('Removing duplicate style tags...');
  // Keep the first one, remove others
  for (let i = 1; i < problematicLines.length; i++) {
    const lineIndex = problematicLines[i];
    lines[lineIndex] = '<!-- Removed duplicate style tag -->';
  }
}

// Write modified file
fs.writeFileSync(filePath, lines.join('\n'));
console.log('File updated successfully!'); 