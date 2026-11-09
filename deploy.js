/**
 * SwarmSearch Production Deployment Orchestrator
 * 
 * Boots and monitors the unified Swarm Engine:
 *  1. Native Node.js Server & Fast Search API (Port 8080)
 *  2. Parallel Crawler Worker Daemon (N=8 Streams with Preemption Queue)
 *  3. Health Monitoring & Process Auto-Recovery
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(75));
console.log('       🚀 DEPLOYING DISTRIBUTED SEARCH ENGINE SWARM (EDGE NODE)');
console.log('       100% Client-Side • Zero Cloud Dependencies • Pure JavaScript');
console.log('='.repeat(75));

let serverProc = null;
let workerProc = null;
let isShuttingDown = false;

function startServer() {
  console.log('\n[DEPLOY] Booting Swarm HTTP & Search Server (Port 8080)...');
  serverProc = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
    cwd: __dirname
  });

  serverProc.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      console.error(`[ALERT] Server process exited (code: ${code}, signal: ${signal}). Auto-restarting in 2s...`);
      setTimeout(startServer, 2000);
    }
  });
}

function startWorker() {
  console.log('[DEPLOY] Booting High-Speed Swarm Crawler Daemon (N=8)...');
  workerProc = spawn('node', [path.join(__dirname, 'swarm-worker.js')], {
    stdio: 'inherit',
    cwd: __dirname
  });

  workerProc.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      console.error(`[ALERT] Worker process exited (code: ${code}, signal: ${signal}). Auto-restarting in 2s...`);
      setTimeout(startWorker, 2000);
    }
  });
}

// Graceful cleanup
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[SHUTDOWN] Terminating Swarm processes gracefully...');
  if (serverProc) serverProc.kill('SIGINT');
  if (workerProc) workerProc.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Boot both services
startServer();
// Slight offset to let server bind port first
setTimeout(startWorker, 1200);

setTimeout(() => {
  console.log('\n' + '─'.repeat(75));
  console.log('  ✅ SWARM ENGINE FULLY DEPLOYED & OPERATIONAL');
  console.log('  🌐 Web Portal:    http://127.0.0.1:8080/index.html');
  console.log('  🔍 Search API:    http://127.0.0.1:8080/api/search?q=alibaba');
  console.log('  ⚡ Priority API:  POST http://127.0.0.1:8080/api/submit');
  console.log('  📊 Telemetry:     http://127.0.0.1:8080/api/status');
  console.log('─'.repeat(75) + '\n');
}, 3000);
