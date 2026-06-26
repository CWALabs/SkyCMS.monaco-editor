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
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const skyCmsRepoRoot = resolveSkyCmsRepoRoot();

const DIST_DIR = path.resolve(__dirname, '../dist');
const DIST_MONACO_ASSETS = path.resolve(__dirname, '../dist/monaco/min/vs');
const SKYCMS_EDITOR_PKG = path.resolve(skyCmsRepoRoot, 'Editor/wwwroot/lib/monaco-editor-integration');
const SKYCMS_MONACO_VS = path.resolve(skyCmsRepoRoot, 'Editor/wwwroot/lib/monaco/min/vs');
const IS_DRY_RUN = process.argv.includes('--dry-run');

function resolveSkyCmsRepoRoot() {
  const configuredRoot = process.env.SKYCMS_REPO_ROOT?.trim();
  if (configuredRoot) {
    const resolvedConfiguredRoot = path.resolve(configuredRoot);
    if (isSkyCmsRepoRoot(resolvedConfiguredRoot)) {
      return resolvedConfiguredRoot;
    }

    throw new Error(`SKYCMS_REPO_ROOT does not point to a valid SkyCMS repo: ${resolvedConfiguredRoot}`);
  }

  const searchRoots = [repoRoot, path.dirname(repoRoot), path.dirname(path.dirname(repoRoot))];
  for (const searchRoot of searchRoots) {
    const candidate = path.resolve(searchRoot, 'SkyCMS');
    if (isSkyCmsRepoRoot(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate the SkyCMS repo. Set SKYCMS_REPO_ROOT to the SkyCMS repository root.');
}

function isSkyCmsRepoRoot(rootPath) {
  return fs.existsSync(path.join(rootPath, 'Editor', 'wwwroot'));
}

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

  // Ensure deployment is deterministic by removing stale files first.
  if (IS_DRY_RUN) {
    console.log(`   • [dry-run] remove existing directory: ${SKYCMS_EDITOR_PKG}`);
  } else {
    fs.rmSync(SKYCMS_EDITOR_PKG, { recursive: true, force: true });
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
    console.log(`   • [dry-run] remove existing directory: ${SKYCMS_MONACO_VS}`);
    console.log(`   • [dry-run] ${DIST_MONACO_ASSETS} -> ${SKYCMS_MONACO_VS}`);
  } else {
    fs.rmSync(SKYCMS_MONACO_VS, { recursive: true, force: true });
    fs.mkdirSync(SKYCMS_MONACO_VS, { recursive: true });
    fs.cpSync(DIST_MONACO_ASSETS, SKYCMS_MONACO_VS, { recursive: true });
  }

  if (!IS_DRY_RUN) {
    writeDeployManifest();
  }

  console.log(IS_DRY_RUN ? '✅ Dry-run complete (Monaco static assets)' : '✅ Monaco static assets copied');
  console.log(`   To: ${SKYCMS_MONACO_VS}`);
}

function writeDeployManifest() {
  const integrationPkg = require('../package.json');
  const monacoPkg = require('../node_modules/monaco-editor/package.json');

  const manifest = {
    deployedAt: new Date().toISOString(),
    monacoEditorVersion: monacoPkg.version,
    integrationVersion: integrationPkg.version,
    nodeVersion: process.version,
  };

  const manifestPath = path.join(SKYCMS_MONACO_VS, 'skycms-deploy-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('\n📋 Deploy manifest written:');
  console.log(`   monaco-editor:  ${manifest.monacoEditorVersion}`);
  console.log(`   integration:    ${manifest.integrationVersion}`);
  console.log(`   deployed at:    ${manifest.deployedAt}`);
  console.log(`   manifest path:  ${manifestPath}`);
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
