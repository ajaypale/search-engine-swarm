import fs from 'node:fs';
import readline from 'node:readline';

async function cleanAndUpdate() {
  console.log('[CLEANUP] Starting index verification and redirect purge...');

  // 1. Count exact lines in search-index.jsonl
  let exactTotal = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream('search-index.jsonl'),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) exactTotal++;
  }
  console.log(`[CLEANUP] Exact verified count in search-index.jsonl: ${exactTotal}`);

  // 2. Load swarm-data.json
  const swarmData = JSON.parse(fs.readFileSync('swarm-data.json', 'utf8'));

  // 3. Purge any redirect stubs from swarm-data.json
  const redirectTitleRegex = /^(30[1278]\s*moved|moved permanently|redirecting(\.\.\.)?|found|object moved)$/i;
  const beforeCount = swarmData.search_index.length;

  swarmData.search_index = swarmData.search_index.filter(doc => {
    const title = (doc.title || '').trim();
    if (redirectTitleRegex.test(title)) return false;
    if (title.toLowerCase().startsWith('redirecting')) return false;
    if (title.toLowerCase().includes('301 moved')) return false;
    if (title.toLowerCase().includes('302 found')) return false;
    return true;
  });

  const purgedCount = beforeCount - swarmData.search_index.length;
  console.log(`[CLEANUP] Purged ${purgedCount} redirect stubs from curated index.`);

  // 4. Update total_indexed to exact master dataset count
  swarmData.total_indexed = exactTotal;

  fs.writeFileSync('swarm-data.json', JSON.stringify(swarmData, null, 2), 'utf8');
  console.log(`[CLEANUP] Saved swarm-data.json with total_indexed = ${exactTotal}`);
}

cleanAndUpdate();
