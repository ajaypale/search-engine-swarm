/**
 * SwarmSearch Instant Live Auto-Deploy Daemon
 * 
 * Watches all client-facing files:
 *  - app.js
 *  - firebase-config.js
 *  - index.html
 *  - style.css
 *  - swarm-data.json
 * 
 * As soon as any file is edited or updated, debounces 1.5s and automatically executes
 * `firebase deploy --only hosting:swarm --project palengineersajaypal`
 * 
 * Result: ZERO manual deploy commands required. Every code change goes live instantly!
 */

import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WATCHED_FILES = new Set([
  'app.js',
  'firebase-config.js',
  'index.html',
  'style.css',
  'firebase.json',
  'manifest.json'
]);

let debounceTimer = null;
let isDeploying = false;
let pendingDeploy = false;
const DEBOUNCE_MS = 1500;

function runFirebaseDeploy(triggerFile) {
  if (isDeploying) {
    pendingDeploy = true;
    return;
  }

  isDeploying = true;
  pendingDeploy = false;

  console.log(`\n[AUTO-DEPLOY] ⚡ Detected change in "${triggerFile}". Starting instant deployment...`);
  const startTime = Date.now();

  const deploy = spawn('npx', ['firebase', 'deploy', '--only', 'hosting:swarm', '--project', 'palengineersajaypal'], {
    shell: true,
    cwd: __dirname
  });

  deploy.stdout.on('data', data => {
    const text = data.toString();
    if (text.includes('upload complete') || text.includes('release complete') || text.includes('Deploy complete')) {
      process.stdout.write(`[AUTO-DEPLOY] ${text.trim()}\n`);
    }
  });

  deploy.stderr.on('data', data => {
    console.error(`[AUTO-DEPLOY ERROR] ${data.toString().trim()}`);
  });

  deploy.on('close', code => {
    isDeploying = false;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (code === 0) {
      console.log(`[AUTO-DEPLOY] ✅ Live deployed in ${duration}s!`);
      console.log(`[AUTO-DEPLOY] 🌐 Production URL: https://pal-swarm-search.web.app\n`);
    } else {
      console.error(`[AUTO-DEPLOY] ❌ Deploy exited with code ${code} after ${duration}s.\n`);
    }

    if (pendingDeploy) {
      console.log('[AUTO-DEPLOY] Processing queued change...');
      setTimeout(() => runFirebaseDeploy('queued changes'), 500);
    }
  });
}

function startWatcher() {
  console.log('='.repeat(70));
  console.log('   ⚡ SWARMSEARCH INSTANT LIVE AUTO-DEPLOY DAEMON ACTIVE');
  console.log('   Watching: app.js, firebase-config.js, index.html, style.css...');
  console.log('   Target: https://pal-swarm-search.web.app');
  console.log('='.repeat(70) + '\n');

  watch(__dirname, (eventType, filename) => {
    if (!filename) return;
    if (WATCHED_FILES.has(filename)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runFirebaseDeploy(filename);
      }, DEBOUNCE_MS);
    }
  });
}

startWatcher();
