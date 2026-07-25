import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'public', 'app-config.json');
const outputPath = path.join(root, 'dist', 'app-config.json');

if (!fs.existsSync(outputPath)) {
  throw new Error('dist/app-config.json was not produced by the web build.');
}

const source = fs.readFileSync(sourcePath);
const output = fs.readFileSync(outputPath);
if (!source.equals(output)) {
  throw new Error('The web build changed app-config.json instead of copying it byte-for-byte.');
}

JSON.parse(output.toString('utf8'));
console.log('web-config-output-smoke: PASS');
