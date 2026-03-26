#!/usr/bin/env node

/**
 * Upstream Sync Workflow for Monaco Editor
 * 
 * Manages syncing changes from the official monaco-editor repository
 * back into the SkyCMS fork, handling merges and conflict resolution.
 * 
 * Commands:
 *   - status: Show current sync status
 *   - sync-upstream: Fetch latest upstream changes
 *   - prepare-sync-branch: Create a sync branch
 *   - merge-into-skycms: Merge synced changes into main
 *   - run-all: Execute full workflow
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const command = process.argv[2] || 'status';

async function runCommand(cmd, description = '') {
  if (description) console.log(`\n📌 ${description}`);
  console.log(`   $ ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: REPO_ROOT });
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

async function status() {
  console.log('📊 Checking sync status...\n');
  await runCommand('git status', 'Current branch status');
  await runCommand('git log --oneline -5', 'Recent commits');
  console.log('\n💡 Tip: Add upstream with: git remote add upstream https://github.com/microsoft/monaco-editor.git');
}

async function syncUpstream() {
  console.log('🔄 Syncing with upstream repository...\n');
  
  // Check if upstream exists
  try {
    await runCommand('git remote get-url upstream', 'Checking upstream remote');
  } catch {
    console.log('   ⚠️  Upstream remote not found. Adding...');
    await runCommand('git remote add upstream https://github.com/microsoft/monaco-editor.git', 'Adding upstream');
  }

  await runCommand('git fetch upstream', 'Fetching upstream changes');
  console.log('\n✅ Upstream sync complete. Review changes and run: pnpm sync:prepare');
}

async function prepareSyncBranch() {
  console.log('🌿 Preparing sync branch...\n');
  
  const branchName = `sync/upstream-${new Date().toISOString().split('T')[0]}`;
  
  await runCommand('git fetch upstream', 'Fetching latest upstream');
  await runCommand(`git checkout -b ${branchName}`, 'Creating sync branch');
  await runCommand('git merge upstream/main --no-commit --no-ff', 'Merging upstream/main');
  
  console.log(`\n✅ Sync branch created: ${branchName}`);
  console.log('   Review merge conflicts if any, then run: pnpm sync:merge');
}

async function mergeIntoSkyCMS() {
  console.log('🔀 Merging sync branch into main...\n');
  
  const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT });
  const currentBranch = stdout.trim();
  
  if (currentBranch === 'main') {
    console.log('❌ Already on main. Checkout the sync branch first.');
    return;
  }

  console.log(`   Current branch: ${currentBranch}`);
  
  await runCommand('git commit -m "chore: merge upstream changes"', 'Committing merge');
  await runCommand('git checkout main', 'Switching to main');
  await runCommand(`git merge ${currentBranch}`, 'Merging into main');
  
  console.log('\n✅ Merge complete. Push with: git push origin main');
}

async function runAll() {
  try {
    console.log('🚀 Running full sync workflow...\n');
    await syncUpstream();
    await prepareSyncBranch();
    console.log('\n⚠️  Review the merge before running: pnpm sync:merge');
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    switch (command) {
      case 'status':
        await status();
        break;
      case 'sync-upstream':
        await syncUpstream();
        break;
      case 'prepare-sync-branch':
        await prepareSyncBranch();
        break;
      case 'merge-into-skycms':
        await mergeIntoSkyCMS();
        break;
      case 'run-all':
        await runAll();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Available commands: status, sync-upstream, prepare-sync-branch, merge-into-skycms, run-all');
        process.exit(1);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
