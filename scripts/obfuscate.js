const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const srcDir = path.join(__dirname, '..');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const obfuscatorConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.75,
  splitStrings: true,
  splitStringsChunkLength: 10,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  disableConsoleOutput: false,
};

const filesToObfuscate = ['main.js', 'preload.js', 'renderer.js'];

for (const file of filesToObfuscate) {
  const inputPath = path.join(srcDir, file);
  const outputPath = path.join(buildDir, file);

  console.log(`Obfuscating ${file}...`);
  const source = fs.readFileSync(inputPath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, obfuscatorConfig);
  fs.writeFileSync(outputPath, result.getObfuscatedCode());
  console.log(`  -> ${outputPath}`);
}

// Copy index.html with renderer.js path updated to build/renderer.js
console.log('Updating index.html for production...');
const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const updatedHtml = html.replace(
  'src="renderer.js"',
  'src="build/renderer.js"'
);
fs.writeFileSync(path.join(srcDir, 'index.html.prod'), updatedHtml);

// Replace original index.html temporarily for the build
// electron-builder will pick up this version
fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(srcDir, 'index.html.dev'));
fs.writeFileSync(path.join(srcDir, 'index.html'), updatedHtml);

console.log('Obfuscation complete.');
