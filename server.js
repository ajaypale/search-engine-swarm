/**
 * SwarmSearch High-Performance Native Server & Search API
 * 
 * Features:
 *  1. Serves Web UI & Assets (Port 8080)
 *  2. High-Speed Full-Text Search API: GET /api/search?q=... across 34,000+ indexed pages
 *  3. Priority Submission Bridge: POST /api/submit pushes directly to Priority Queue
 *  4. Telemetry Endpoint: GET /api/status returns live worker stats
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8080;
const PRIORITY_FILE = path.join(__dirname, 'priority-submissions.json');
const SWARM_DATA_FILE = path.join(__dirname, 'swarm-data.json');
const INDEX_STREAM_FILE = path.join(__dirname, 'search-index.jsonl');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Compact in-memory fast index for instant search queries
let fastSearchIndex = [];

async function buildFastSearchIndex() {
  const curatedDocs = [];
  const streamDocs = [];

  // 1. First load curated snapshot from swarm-data.json (guaranteed EV, B2B, Tech docs - permanently protected from eviction)
  try {
    if (existsSync(SWARM_DATA_FILE)) {
      const sData = JSON.parse(await fs.readFile(SWARM_DATA_FILE, 'utf-8'));
      if (sData && sData.search_index) {
        curatedDocs.push(...sData.search_index);
      }
    }
  } catch {}

  // 2. Supplement with freshest lines from streaming log
  if (existsSync(INDEX_STREAM_FILE)) {
    const rl = readline.createInterface({
      input: createReadStream(INDEX_STREAM_FILE, { encoding: 'utf-8' }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const doc = JSON.parse(line);
        streamDocs.unshift({
          url: doc.url,
          title: doc.title,
          content: doc.content ? doc.content.slice(0, 1000) : '',
          content_hash: doc.content_hash,
          verification_status: doc.verification_status || 'verified',
          indexed_at: doc.indexed_at
        });
        if (streamDocs.length >= 5000) streamDocs.pop(); // Keep stream bounded
      } catch {}
    }
  }

  fastSearchIndex = [...curatedDocs, ...streamDocs];
  console.log(`[SEARCH ENGINE] Loaded ${fastSearchIndex.length} high-priority indexed pages into Fast Search Cache.`);
}

// Re-index memory cache every 10 seconds
setInterval(buildFastSearchIndex, 10000);
buildFastSearchIndex();

function normalizeUrl(input) {
  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch {
    return null;
  }
}

async function addPriorityUrl(url) {
  const norm = normalizeUrl(url);
  if (!norm) throw new Error('Invalid URL format');

  let queue = [];
  try {
    if (existsSync(PRIORITY_FILE)) {
      const content = await fs.readFile(PRIORITY_FILE, 'utf-8');
      queue = JSON.parse(content || '[]');
    }
  } catch {
    queue = [];
  }

  if (!queue.includes(norm)) {
    queue.push(norm);
    await fs.writeFile(PRIORITY_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  }

  return norm;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // --- API: POST /api/submit ---
  if (req.method === 'POST' && pathname === '/api/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing "url" parameter' }));
          return;
        }

        const normalized = await addPriorityUrl(payload.url);
        console.log(`[SERVER] High-Priority URL Submitted: ${normalized}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Injected ${normalized} into High-Priority Worker Slot #1`,
          url: normalized
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API: GET /api/search?q=query ---
  if (req.method === 'GET' && pathname === '/api/search') {
    const q = (reqUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ query: q, results: [], total: 0 }));
      return;
    }

    const expansions = {
      'ev': ['ev', 'evs', 'electric vehicle', 'electric vehicles', 'electric car', 'electric scooter', 'ev charger', 'battery pack'],
      'ai': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural'],
      'b2b': ['b2b', 'wholesale', 'manufacturers', 'suppliers', 'exporters'],
      'seo': ['seo', 'search engine optimization', 'rankings', 'google search'],
      'api': ['api', 'rest api', 'endpoints', 'interface', 'sdk']
    };

    const searchCandidates = new Set([q]);
    for (const [key, terms] of Object.entries(expansions)) {
      if (new RegExp(`\\b${key}\\b`, 'i').test(q)) {
        terms.forEach(t => searchCandidates.add(t));
      }
    }

    const matches = [];

    for (const doc of fastSearchIndex) {
      const lowerTitle = (doc.title || '').toLowerCase();
      const lowerContent = (doc.content || '').toLowerCase();
      const lowerUrl = (doc.url || '').toLowerCase();

      let score = 0;

      // 1. Direct Whole-Phrase Match (Strict word-boundary for short queries <= 3 chars)
      const isQueryShort = q.length <= 3;
      if (isQueryShort) {
        const wholeQueryRegex = new RegExp(`\\b${q}\\b`, 'i');
        if (wholeQueryRegex.test(lowerTitle)) score += 100;
        if (wholeQueryRegex.test(lowerContent)) score += 30;
      } else {
        if (lowerTitle.includes(q)) score += 80;
        if (lowerContent.includes(q)) score += 20;
      }

      // 2. Strict Word-Boundary Match for Acronyms & Candidates
      for (const term of searchCandidates) {
        const isShort = term.length <= 3;
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${safeTerm}\\b`, 'i');

        if (wordRegex.test(lowerTitle)) {
          score += 60;
        } else if (!isShort && lowerTitle.includes(term)) {
          score += 10;
        }

        if (wordRegex.test(lowerContent)) {
          score += 25;
        } else if (!isShort && lowerContent.includes(term)) {
          score += 5;
        }

        if (wordRegex.test(lowerUrl)) score += 40;
      }

      if (score > 0) {
        matches.push({ ...doc, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const results = matches.slice(0, 30);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      query: q,
      total: matches.length,
      results
    }));
    return;
  }

  // --- API: GET /api/status ---
  if (req.method === 'GET' && pathname === '/api/status') {
    try {
      if (existsSync(SWARM_DATA_FILE)) {
        const data = await fs.readFile(SWARM_DATA_FILE, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total_indexed: 0, frontier: [], search_index: [] }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  try {
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Prevent caching for live JSON telemetry
    if (ext === '.json' || ext === '.jsonl') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Server Error: ${err.message}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SWARM SERVER] Running at http://127.0.0.1:${PORT}/`);
  console.log(`[SWARM SERVER] UI: http://127.0.0.1:${PORT}/index.html`);
  console.log(`[SWARM SERVER] Priority API: POST http://127.0.0.1:${PORT}/api/submit`);
  console.log(`[SWARM SERVER] Search API: GET http://127.0.0.1:${PORT}/api/search?q=...`);
});
