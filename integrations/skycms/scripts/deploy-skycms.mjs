#!/usr/bin/env node

/**
 * Deploy SkyCMS Monaco Editor integration into the SkyCMS Editor static asset path.
 *
 * This script:
 * 1. Builds integration artifacts if missing
 * 2. Copies integration bundle files into SkyCMS Editor
 * 3. Copies Monaco static worker/language assets into SkyCMS Editor
 *
 * Use --dry-run to validate paths and copy operations without writing files.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST_DIR = path.resolve(__dirname, '../dist');
const DIST_MONACO_ASSETS = path.resolve(__dirname, '../dist/monaco/min/vs');
const SKYCMS_EDITOR_PKG = path.resolve(__dirname, '../../../../../SkyCMS/Editor/wwwroot/lib/monaco-editor-integration');
const SKYCMS_MONACO_VS = path.resolve(__dirname, '../../../../../SkyCMS/Editor/wwwroot/lib/monaco/min/vs');
const IS_DRY_RUN = process.argv.includes('--dry-run');

async function ensureBuilt() {
  console.log('🔨 Checking if library is built...');
  if (!fs.existsSync(DIST_DIR) || fs.readdirSync(DIST_DIR).length === 0) {
    console.log('📦 Building library...');
    await execAsync('pnpm build:lib && pnpm build:assets', { cwd: path.resolve(__dirname, '..') });
  }
  console.log('✅ Library is ready');
}

async function copyDistToSkyCMS() {
  console.log(`📁 Copying integration distribution to SkyCMS Editor...`);
  console.log(`   From: ${DIST_DIR}`);
  console.log(`   To:   ${SKYCMS_EDITOR_PKG}`);

  // Ensure destination exists
  if (!IS_DRY_RUN && !fs.existsSync(SKYCMS_EDITOR_PKG)) {
    fs.mkdirSync(SKYCMS_EDITOR_PKG, { recursive: true });
  }

  // Copy files
  const files = fs.readdirSync(DIST_DIR);
  for (const file of files) {
    const src = path.join(DIST_DIR, file);
    const dst = path.join(SKYCMS_EDITOR_PKG, file);
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      continue;
    }

    if (IS_DRY_RUN) {
      console.log(`   • [dry-run] ${src} -> ${dst}`);
    } else {
      fs.copyFileSync(src, dst);
      console.log(`   ✓ ${file}`);
    }
  }

  console.log(IS_DRY_RUN ? '✅ Dry-run complete (integration files)' : '✅ Deployment complete');
}

async function copyMonacoAssetsToSkyCMS() {
  if (!fs.existsSync(DIST_MONACO_ASSETS)) {
    console.log('ℹ️ Monaco static assets were not found in dist; skipping worker asset copy.');
    console.log('   Run "pnpm build:assets" if you need to refresh packaged Monaco assets.');
    return;
  }

  if (IS_DRY_RUN) {
    console.log(`   • [dry-run] ${DIST_MONACO_ASSETS} -> ${SKYCMS_MONACO_VS}`);
  } else {
    fs.mkdirSync(SKYCMS_MONACO_VS, { recursive: true });
    fs.cpSync(DIST_MONACO_ASSETS, SKYCMS_MONACO_VS, { recursive: true });
  }

  console.log(IS_DRY_RUN ? '✅ Dry-run complete (Monaco static assets)' : '✅ Monaco static assets copied');
  console.log(`   To: ${SKYCMS_MONACO_VS}`);
}

async function main() {
  try {
    console.log('🚀 Deploying SkyCMS Monaco Editor assets...\n');
    if (IS_DRY_RUN) {
      console.log('ℹ️ Running in dry-run mode. No files will be written.\n');
    }
    
    await ensureBuilt();
    await copyDistToSkyCMS();
    await copyMonacoAssetsToSkyCMS();

    console.log(`\n✨ Monaco Editor ${IS_DRY_RUN ? 'dry-run validation' : 'deployment'} successful!`);
    console.log(`   Editor files are available at: ${SKYCMS_EDITOR_PKG}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Deployment failed:', message);
    process.exit(1);
  }
}

main();
