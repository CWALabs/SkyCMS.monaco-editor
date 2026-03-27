#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const integrationRoot = path.resolve(__dirname, '..');

const sourceVs = path.resolve(integrationRoot, 'node_modules', 'monaco-editor', 'min', 'vs');
const targetVs = path.resolve(integrationRoot, 'dist', 'monaco', 'min', 'vs');

if (!existsSync(sourceVs)) {
  console.error(`Missing Monaco assets at: ${sourceVs}`);
  console.error('Run "pnpm install" first.');
  process.exit(1);
}

mkdirSync(targetVs, { recursive: true });
cpSync(sourceVs, targetVs, { recursive: true });

console.log('Packaged Monaco static assets:');
console.log(`  source: ${sourceVs}`);
console.log(`  target: ${targetVs}`);
