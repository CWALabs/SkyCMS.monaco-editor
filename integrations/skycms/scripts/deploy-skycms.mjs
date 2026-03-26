#!/usr/bin/env node

/**
 * Deploy SkyCMS Monaco Editor integration to Sky.Editor
 * 
 * This script:
 * 1. Builds the library if not already built
 * 2. Copies the built files to the Sky.Editor package location
 * 3. Updates version info if needed
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST_DIR = path.resolve(__dirname, '../dist');
const PLAYGROUND_DIST_DIR = path.resolve(__dirname, '../playground-dist');
const SKYCMS_EDITOR_PKG = path.resolve(__dirname, '../../../../SkyCMS/Sky.Editor/wwwroot/monaco-editor');

async function ensureBuilt() {
  console.log('🔨 Checking if library is built...');
  if (!fs.existsSync(DIST_DIR) || fs.readdirSync(DIST_DIR).length === 0) {
    console.log('📦 Building library...');
    await execAsync('pnpm build:lib', { cwd: path.resolve(__dirname, '..') });
  }
  console.log('✅ Library is ready');
}

async function copyDistToSkyCMS() {
  console.log(`📁 Copying distribution to Sky.Editor...`);
  console.log(`   From: ${DIST_DIR}`);
  console.log(`   To:   ${SKYCMS_EDITOR_PKG}`);

  // Ensure destination exists
  if (!fs.existsSync(SKYCMS_EDITOR_PKG)) {
    fs.mkdirSync(SKYCMS_EDITOR_PKG, { recursive: true });
  }

  // Copy files
  const files = fs.readdirSync(DIST_DIR);
  for (const file of files) {
    const src = path.join(DIST_DIR, file);
    const dst = path.join(SKYCMS_EDITOR_PKG, file);
    fs.copyFileSync(src, dst);
    console.log(`   ✓ ${file}`);
  }

  console.log('✅ Deployment complete');
}

async function main() {
  try {
    console.log('🚀 Deploying SkyCMS Monaco Editor to Sky.Editor...\n');
    
    await ensureBuilt();
    await copyDistToSkyCMS();

    console.log('\n✨ Monaco Editor deployment successful!');
    console.log(`   Editor files are available at: ${SKYCMS_EDITOR_PKG}`);
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
