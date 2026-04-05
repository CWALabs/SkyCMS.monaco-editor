#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

const defaults = {
  sourceRemote: process.env.SOURCE_REMOTE || 'upstream',
  sourceBranch: process.env.SOURCE_BRANCH || 'main',
  upstreamUrl: process.env.UPSTREAM_URL || 'https://github.com/microsoft/monaco-editor.git',
  mirrorBranch: process.env.MIRROR_BRANCH || 'vendor/monaco-editor',
  automationBranch: process.env.AUTOMATION_BRANCH || 'sync/vendor-monaco-editor',
  customBranch: process.env.CUSTOM_BRANCH || 'skycms/main',
  forkRemote: process.env.FORK_REMOTE || '',
};

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const command = args[0];
const options = parseOptions(args.slice(1));

try {
  if (command === 'status') {
    cmdStatus();
  } else if (command === 'sync-upstream') {
    cmdSyncUpstream();
  } else if (command === 'prepare-sync-branch') {
    cmdPrepareSyncBranch();
  } else if (command === 'merge-into-skycms') {
    cmdMergeIntoSkyCms();
  } else if (command === 'run-all') {
    cmdRunAll();
  } else {
    fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error.message || String(error));
}

function cmdRunAll() {
  cmdSyncUpstream();
  cmdPrepareSyncBranch();

  if (hasFlag('merge')) {
    cmdMergeIntoSkyCms();
  } else {
    console.log('Skipping merge-into-skycms (pass --merge to include it).');
  }
}

function cmdStatus() {
  ensureGitRepo();

  const sourceRemote = getOption('source-remote', defaults.sourceRemote);
  const sourceBranch = getOption('source-branch', defaults.sourceBranch);
  const sourceRef = `${sourceRemote}/${sourceBranch}`;
  const mirrorRef = getOption('mirror-branch', defaults.mirrorBranch);
  const automationRef = getOption('automation-branch', defaults.automationBranch);
  const customRef = getOption('custom-branch', defaults.customBranch);
  const forkRemote = resolveForkRemote(false) || '(not resolved)';

  console.log('=== SkyCMS Monaco Upstream Sync Status ===');
  console.log(`Source:     ${sourceRef}`);
  console.log(`Mirror:     ${mirrorRef}`);
  console.log(`Review:     ${automationRef}`);
  console.log(`Custom:     ${customRef}`);
  console.log(`Fork remote:${forkRemote}`);
  console.log('');

  if (branchExists(sourceRef) && branchExists(mirrorRef)) {
    printAheadBehind(mirrorRef, sourceRef, `${mirrorRef} vs ${sourceRef}`);
  } else {
    console.log(`Skipping: ${mirrorRef} vs ${sourceRef} (missing ref)`);
  }

  if (branchExists(mirrorRef) && branchExists(automationRef)) {
    printAheadBehind(automationRef, mirrorRef, `${automationRef} vs ${mirrorRef}`);
  } else {
    console.log(`Skipping: ${automationRef} vs ${mirrorRef} (missing ref)`);
  }

  if (branchExists(mirrorRef) && branchExists(customRef)) {
    printAheadBehind(customRef, mirrorRef, `${customRef} vs ${mirrorRef}`);
  } else {
    console.log(`Skipping: ${customRef} vs ${mirrorRef} (missing ref)`);
  }

  console.log('');
  console.log(`Current branch: ${gitOut(['branch', '--show-current']) || '(detached HEAD)'}`);
  console.log(`Working tree clean: ${gitOut(['status', '--short']) === '' ? 'yes' : 'no'}`);
}

function cmdSyncUpstream() {
  ensureGitRepo();
  ensureCleanWorkingTree();

  const sourceRemote = getOption('source-remote', defaults.sourceRemote);
  const sourceBranch = getOption('source-branch', defaults.sourceBranch);
  const upstreamUrl = getOption('upstream-url', defaults.upstreamUrl);
  const mirrorBranch = getOption('mirror-branch', defaults.mirrorBranch);
  const currentBranch = gitOut(['branch', '--show-current']);

  ensureSourceRemote(sourceRemote, upstreamUrl);
  git(['fetch', '--prune', sourceRemote]);
  ensureLocalBranchFrom(mirrorBranch, `${sourceRemote}/${sourceBranch}`);
  git(['checkout', mirrorBranch]);
  git(['merge', '--ff-only', `${sourceRemote}/${sourceBranch}`]);

  if (hasFlag('push')) {
    const forkRemote = resolveForkRemote(true);
    git(['push', forkRemote, mirrorBranch]);
  }

  restoreOriginalBranch(currentBranch, mirrorBranch);
  console.log(`Sync complete: ${mirrorBranch} is aligned with ${sourceRemote}/${sourceBranch}`);
}

function cmdPrepareSyncBranch() {
  ensureGitRepo();
  ensureCleanWorkingTree();

  const sourceRemote = getOption('source-remote', defaults.sourceRemote);
  const sourceBranch = getOption('source-branch', defaults.sourceBranch);
  const upstreamUrl = getOption('upstream-url', defaults.upstreamUrl);
  const mirrorBranch = getOption('mirror-branch', defaults.mirrorBranch);
  const automationBranch = getOption('automation-branch', defaults.automationBranch);
  const currentBranch = gitOut(['branch', '--show-current']);

  ensureSourceRemote(sourceRemote, upstreamUrl);
  git(['fetch', '--prune', sourceRemote]);
  ensureLocalBranchFrom(mirrorBranch, `${sourceRemote}/${sourceBranch}`);
  git(['checkout', '-B', automationBranch, mirrorBranch]);

  if (hasFlag('push')) {
    const forkRemote = resolveForkRemote(true);
    git(['push', '--force-with-lease', forkRemote, automationBranch]);
  }

  restoreOriginalBranch(currentBranch, automationBranch);
  console.log(`Prepared ${automationBranch} from ${mirrorBranch}`);
}

function cmdMergeIntoSkyCms() {
  ensureGitRepo();
  ensureCleanWorkingTree();

  const automationBranch = getOption('automation-branch', defaults.automationBranch);
  const customBranch = getOption('custom-branch', defaults.customBranch);

  if (!branchExists(automationBranch)) {
    fail(`Missing branch: ${automationBranch}`);
  }

  ensureLocalBranch(customBranch);
  git(['checkout', customBranch]);
  git(['merge', '--no-ff', automationBranch]);

  if (hasFlag('push')) {
    const forkRemote = resolveForkRemote(true);
    git(['push', forkRemote, customBranch]);
  }

  console.log(`Merge complete: ${automationBranch} -> ${customBranch}`);
}

function parseOptions(argv) {
  const parsed = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      parsed.set(key, next);
      index += 1;
    } else {
      parsed.set(key, true);
    }
  }

  return parsed;
}

function getOption(key, fallback) {
  const value = options.get(key);
  if (value === undefined || value === true) {
    return fallback;
  }

  return value;
}

function hasFlag(key) {
  return options.get(key) === true;
}

function git(gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    fail(`git ${gitArgs.join(' ')} failed`);
  }
}

function gitOut(gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(`git ${gitArgs.join(' ')} failed`);
  }

  return result.stdout.trim();
}

function ensureGitRepo() {
  const inside = gitOut(['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    fail('Not inside a git work tree.');
  }
}

function ensureCleanWorkingTree() {
  const status = gitOut(['status', '--porcelain']);
  if (status !== '') {
    fail('Working tree is not clean. Commit/stash changes first.');
  }
}

function ensureRemoteExists(remoteName) {
  const remotes = gitOut(['remote']).split(/\r?\n/).filter(Boolean);
  return remotes.includes(remoteName);
}

function ensureSourceRemote(remoteName, upstreamUrl) {
  if (ensureRemoteExists(remoteName)) {
    git(['remote', 'set-url', remoteName, upstreamUrl]);
    return;
  }

  git(['remote', 'add', remoteName, upstreamUrl]);
}

function branchExists(refName) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', refName], {
    cwd: repoRoot,
  });

  return result.status === 0;
}

function ensureLocalBranch(branchName) {
  if (branchExists(branchName)) {
    return;
  }

  fail(`Missing local branch: ${branchName}`);
}

function ensureLocalBranchFrom(branchName, startRef) {
  if (branchExists(branchName)) {
    return;
  }

  if (!branchExists(startRef)) {
    fail(`Missing start reference: ${startRef}`);
  }

  git(['checkout', '-b', branchName, startRef]);
}

function restoreOriginalBranch(currentBranch, temporaryBranch) {
  if (currentBranch && currentBranch !== temporaryBranch) {
    git(['checkout', currentBranch]);
  }
}

function resolveForkRemote(required) {
  const configuredForkRemote = getOption('fork-remote', defaults.forkRemote);

  if (configuredForkRemote) {
    if (!ensureRemoteExists(configuredForkRemote)) {
      fail(`Missing fork remote: ${configuredForkRemote}`);
    }

    return configuredForkRemote;
  }

  for (const candidate of ['cwalabs-split', 'origin']) {
    if (ensureRemoteExists(candidate)) {
      return candidate;
    }
  }

  if (required) {
    fail('Unable to resolve a fork remote. Pass --fork-remote explicitly.');
  }

  return '';
}

function printAheadBehind(leftRef, rightRef, label) {
  const out = gitOut(['rev-list', '--left-right', '--count', `${leftRef}...${rightRef}`]);
  const [leftAhead = '0', rightAhead = '0'] = out.split(/\s+/);
  console.log(`${label}: ${leftRef} ahead=${leftAhead}, ${rightRef} ahead=${rightAhead}`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log('SkyCMS Monaco upstream sync workflow');
  console.log('');
  console.log('Commands:');
  console.log('  status');
  console.log('  sync-upstream [--source-remote <name>] [--source-branch <name>] [--upstream-url <url>] [--mirror-branch <name>] [--fork-remote <name>] [--push]');
  console.log('  prepare-sync-branch [--source-remote <name>] [--source-branch <name>] [--upstream-url <url>] [--mirror-branch <name>] [--automation-branch <name>] [--fork-remote <name>] [--push]');
  console.log('  merge-into-skycms [--automation-branch <name>] [--custom-branch <name>] [--fork-remote <name>] [--push]');
  console.log('  run-all [--source-remote <name>] [--source-branch <name>] [--upstream-url <url>] [--mirror-branch <name>] [--automation-branch <name>] [--custom-branch <name>] [--fork-remote <name>] [--push] [--merge]');
  console.log('');
  console.log('Defaults:');
  console.log(`  source-remote:     ${defaults.sourceRemote}`);
  console.log(`  source-branch:     ${defaults.sourceBranch}`);
  console.log(`  upstream-url:      ${defaults.upstreamUrl}`);
  console.log(`  mirror-branch:     ${defaults.mirrorBranch}`);
  console.log(`  automation-branch: ${defaults.automationBranch}`);
  console.log(`  custom-branch:     ${defaults.customBranch}`);
  console.log(`  fork-remote:       ${defaults.forkRemote || 'auto-detect (cwalabs-split, origin)'}`);
}
