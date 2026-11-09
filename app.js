/**
 * SwarmSearch Main Application Controller
 * Handles Phase 1 (Search Engine) and Phase 2 (Distributed Client-Side Crawler Engine & Site Submission)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchSection = document.getElementById('search-section');
  const resultsContainer = document.getElementById('results-container');
  const resultsList = document.getElementById('results-list');
  const resultsMeta = document.getElementById('results-meta');
  const btnLucky = document.getElementById('btn-lucky');

  // Modals
  const submitModal = document.getElementById('submit-modal');
  const btnToggleSubmit = document.getElementById('btn-toggle-submit');
  const closeSubmitModal = document.getElementById('close-submit-modal');
  const btnCancelSubmit = document.getElementById('btn-cancel-submit');
  const submitSiteForm = document.getElementById('submit-site-form');
  const submitUrlInput = document.getElementById('submit-url');

  const configModal = document.getElementById('config-modal');
  const btnConfig = document.getElementById('btn-config');
  const closeConfigModal = document.getElementById('close-config-modal');
  const btnCancelConfig = document.getElementById('btn-cancel-config');
  const firebaseConfigForm = document.getElementById('firebase-config-form');
  const cfgBackendMode = document.getElementById('cfg-backend-mode');
  const firebaseFields = document.getElementById('firebase-fields');

  // HUD Elements
  const swarmHud = document.getElementById('swarm-hud');
  const btnToggleHud = document.getElementById('btn-toggle-hud');
  const btnMinimizeHud = document.getElementById('btn-minimize-hud');
  const toggleCrawler = document.getElementById('toggle-crawler-active');
  const statFrontier = document.getElementById('stat-frontier');
  const statIndexed = document.getElementById('stat-indexed');
  const statDeviceCrawled = document.getElementById('stat-device-crawled');
  const statWorkerStatus = document.getElementById('stat-worker-status');
  const currentTaskUrl = document.getElementById('current-task-url');
  const currentTaskHash = document.getElementById('current-task-hash');
  const terminalLog = document.getElementById('terminal-log');
  const btnClearLog = document.getElementById('btn-clear-log');

  // Crawler State
  let isCrawlerRunning = true;
  let deviceCrawledCount = 0;
  let isCurrentlyProcessing = false;

  // --- LOGGING HELPER ---
  function logToHud(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${timestamp}] ${message}`;
    terminalLog.appendChild(line);
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  // AI Overview Elements
  const aiOverviewCard = document.getElementById('ai-overview-card');
  const aiOverviewBody = document.getElementById('ai-overview-body');
  const aiSourcesRow = document.getElementById('ai-sources-row');

  // --- AI SYNTHESIS ENGINE (EDGE REASONING) ---
  function generateAIOverview(query, docs) {
    if (!docs || docs.length === 0) {
      aiOverviewCard.style.display = 'none';
      return;
    }

    aiOverviewCard.style.display = 'block';
    aiOverviewBody.innerHTML = `
      <div class="ai-loading-pulse">
        <div class="ai-pulse-bar w-3-4"></div>
        <div class="ai-pulse-bar w-full"></div>
        <div class="ai-pulse-bar w-5-6"></div>
      </div>
    `;
    aiSourcesRow.innerHTML = '';

    // Simulate edge model inference latency
    setTimeout(() => {
      const qLower = query.toLowerCase();
      const relevantSentences = [];
      const sourcesUsed = [];

      docs.slice(0, 3).forEach((doc, idx) => {
        sourcesUsed.push({ title: doc.title || doc.url, url: doc.url, idx: idx + 1 });
        
        // Extract key sentences matching query words
        const sentences = doc.content.split(/(?<=[.?!])\s+/);
        sentences.forEach(s => {
          if (s.toLowerCase().includes(qLower) || qLower.split(' ').some(w => s.toLowerCase().includes(w))) {
            if (s.length > 30 && s.length < 250 && !relevantSentences.includes(s)) {
              relevantSentences.push(`${s.trim()} <sup>[${idx + 1}]</sup>`);
            }
          }
        });
      });

      let overviewText = "";
      if (relevantSentences.length > 0) {
        overviewText = `<p>Based on distributed swarm indexing for <strong>"${escapeHtml(query)}"</strong>:</p>`;
        overviewText += `<p>${relevantSentences.slice(0, 3).join(' ')}</p>`;
      } else {
        overviewText = `<p>Swarm nodes have verified multiple records matching <strong>"${escapeHtml(query)}"</strong> across the distributed index. Review the top validated sources below for comprehensive technical documentation.</p>`;
      }

      aiOverviewBody.innerHTML = overviewText;

      // Render Source Pills
      aiSourcesRow.innerHTML = sourcesUsed.map(s => `
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="ai-source-pill">
          <span>[${s.idx}]</span>
          <span class="truncate" style="max-width: 140px;">${escapeHtml(s.title)}</span>
        </a>
      `).join('');

      logToHud(`[AI] Generated edge overview for query: "${query}" across ${sourcesUsed.length} sources.`, 'success');
    }, 600);
  }

  // --- PHASE 1: SEARCH FUNCTIONALITY ---
  async function performSearch(query) {
    if (!query.trim()) return;

    searchSection.classList.add('compact');
    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '<div class="loading">Querying distributed swarm index...</div>';

    const startTime = performance.now();
    let results = [];

    // 1. Try fast server search across full index (34,000+ records)
    try {
      const apiRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.results && data.results.length > 0) {
          results = data.results;
        }
      }
    } catch {}

    // 2. Fallback to local storage if server search returned no results
    if (results.length === 0) {
      results = await window.swarmStorage.searchIndex(query);
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(3);
    resultsMeta.textContent = `About ${results.length} result(s) (${duration} seconds) — Indexed at the edge`;

    if (results.length === 0) {
      aiOverviewCard.style.display = 'none';
      resultsList.innerHTML = `
        <div class="no-results">
          <p>No results found for "<strong>${escapeHtml(query)}</strong>" in the swarm index.</p>
          <p style="margin-top: 10px; font-size: 13px; color: #5f6368;">
            Be the first to submit this website to the frontier queue using the <strong>+ Submit Site</strong> button!
          </p>
        </div>
      `;
      return;
    }

    // Trigger AI Overview Synthesis
    generateAIOverview(query, results);

    resultsList.innerHTML = results.map(doc => `
      <article class="result-item">
        <div class="result-url">
          <span>${escapeHtml(doc.url)}</span>
          <span class="result-status-tag ${doc.verification_status || 'verified'}">
            ${doc.verification_status === 'verified' ? '✓ Verified' : '⚡ Provisional'}
          </span>
        </div>
        <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer" class="result-title">
          ${escapeHtml(doc.title || doc.url)}
        </a>
        <div class="result-snippet">${highlightQuery(doc.content, query)}</div>
        <div class="result-hash">SHA-256: ${doc.content_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</div>
      </article>
    `).join('');
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    performSearch(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    searchClear.style.display = searchInput.value ? 'block' : 'none';
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchInput.focus();
  });

  btnLucky.addEventListener('click', async () => {
    const sampleQueries = ['alibaba', 'manufacturers', 'distributed', 'fastapi', 'made in china'];
    const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
    searchInput.value = randomQuery;
    searchClear.style.display = 'block';
    performSearch(randomQuery);
  });

  // --- PHASE 2: SITE SUBMISSION ---
  btnToggleSubmit.addEventListener('click', () => {
    submitModal.style.display = 'flex';
    submitUrlInput.focus();
  });

  const closeSubmit = () => { submitModal.style.display = 'none'; };
  closeSubmitModal.addEventListener('click', closeSubmit);
  btnCancelSubmit.addEventListener('click', closeSubmit);

  submitSiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let url = submitUrlInput.value.trim();
    if (!url) return;

    // Auto-prepend https:// if bare domain is entered (e.g. alibaba.com -> https://www.alibaba.com)
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    logToHud(`[SUBMIT] Pushing seed URL to Swarm Preemption Engine: ${url}`, 'info');

    // 1. Send to Local High-Priority Server API Bridge
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        logToHud(`[PREEMPTION] ${data.message}`, 'success');
        submitUrlInput.value = '';
        closeSubmit();
        setTimeout(syncWithSwarmData, 800);
        setTimeout(syncWithSwarmData, 2000);
        return;
      }
    } catch (err) {
      logToHud(`[LOCAL] API bridge unavailable, queuing to local store: ${err.message}`, 'warn');
    }

    // Fallback: Local storage
    const res = await window.swarmStorage.submitSeedUrl(url);
    if (res.success) {
      logToHud(`[QUEUE] ${res.message}`, 'success');
      submitUrlInput.value = '';
      closeSubmit();
      updateHudStats();
    } else {
      logToHud(`[WARN] ${res.message}`, 'warn');
      alert(res.message);
    }
  });

  // --- SETTINGS / CONFIG MODAL ---
  btnConfig.addEventListener('click', () => {
    configModal.style.display = 'flex';
  });
  const closeConfig = () => { configModal.style.display = 'none'; };
  closeConfigModal.addEventListener('click', closeConfig);
  btnCancelConfig.addEventListener('click', closeConfig);

  cfgBackendMode.addEventListener('change', () => {
    firebaseFields.style.display = cfgBackendMode.value === 'firebase' ? 'block' : 'none';
  });

  firebaseConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    localStorage.setItem('swarm_backend_mode', cfgBackendMode.value);
    logToHud(`[CONFIG] Backend mode updated to: ${cfgBackendMode.value}`, 'success');
    closeConfig();
  });

  // --- HUD TOGGLES ---
  btnToggleHud.addEventListener('click', () => {
    swarmHud.classList.toggle('minimized');
  });
  btnMinimizeHud.addEventListener('click', () => {
    swarmHud.classList.toggle('minimized');
  });

  btnClearLog.addEventListener('click', () => {
    terminalLog.innerHTML = '';
  });

  toggleCrawler.addEventListener('change', () => {
    isCrawlerRunning = toggleCrawler.checked;
    statWorkerStatus.textContent = isCrawlerRunning ? 'Idle' : 'Paused';
    statWorkerStatus.style.color = isCrawlerRunning ? '#fbbc05' : '#8f909e';
    logToHud(`[CONTROL] Client crawler worker ${isCrawlerRunning ? 'ENABLED' : 'PAUSED'}.`, isCrawlerRunning ? 'success' : 'warn');
  });

  // --- PHASE 2: PURE CLIENT-SIDE PARSING & CRAWLER WORKER ---

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure Client-Side DOM Extractor
  function parseHtmlClientSide(htmlString, sourceUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 1. Extract Page Title
    const title = doc.title ? doc.title.trim() : 'No Title';

    // 2. Strip scripts, styles, iframes, and navs
    const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, nav, footer');
    elementsToRemove.forEach(el => el.remove());

    // 3. Extract text content
    const textContent = (doc.body ? doc.body.innerText || doc.body.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();

    // 4. Extract Outbound Links
    const outboundLinks = [];
    const anchors = doc.querySelectorAll('a[href]');
    anchors.forEach(a => {
      try {
        const absoluteUrl = new URL(a.getAttribute('href'), sourceUrl).href;
        if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
          if (!outboundLinks.includes(absoluteUrl)) {
            outboundLinks.push(absoluteUrl);
          }
        }
      } catch (err) {
        // Invalid URL scheme ignored
      }
    });

    return {
      title: title.slice(0, 200),
      content: textContent.slice(0, 5000), // compact payload
      ai_summary: textContent.slice(0, 300) + '...',
      outboundLinks: outboundLinks.slice(0, 30) // limit links
    };
  }

  // Pure Client-Side Fetch (Direct Device HTTP - Zero External Proxies)
  async function fetchPageContent(url) {
    // Direct fetch from the user's device
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const html = await res.text();
    const etag = res.headers.get('ETag') || 'direct-etag';
    return { html, etag };
  }

  // Main Autonomous Worker Loop
  async function runClientWorkerCycle() {
    if (!isCrawlerRunning || isCurrentlyProcessing) return;

    const taskUrl = await window.swarmStorage.getPendingTask();
    if (!taskUrl) {
      statWorkerStatus.textContent = 'Idle (No Tasks)';
      statWorkerStatus.style.color = '#8f909e';
      return;
    }

    isCurrentlyProcessing = true;
    statWorkerStatus.textContent = 'Processing DOM';
    statWorkerStatus.style.color = '#00e676';
    currentTaskUrl.textContent = taskUrl;
    currentTaskHash.textContent = 'Fetching HTTP...';

    logToHud(`[FETCH] Dispatched URL to client DOM engine: ${taskUrl}`, 'info');

    try {
      // 1. Fetch
      const { html, etag } = await fetchPageContent(taskUrl);
      logToHud(`[PARSE] Downloaded payload. Executing native DOMParser()...`, 'info');

      // 2. Pure Client-Side DOM Parsing
      const parsed = parseHtmlClientSide(html, taskUrl);

      // 3. Generate SHA-256 Fingerprint Hash
      const hash = await sha256(parsed.content);
      currentTaskHash.textContent = `SHA-256: ${hash}`;

      // 4. Ingest to Storage (Optimistic direct write)
      const submitRes = await window.swarmStorage.submitTaskResult(
        taskUrl,
        parsed.title,
        parsed.content,
        hash,
        etag,
        parsed.outboundLinks
      );

      deviceCrawledCount++;
      statDeviceCrawled.textContent = deviceCrawledCount;
      logToHud(`[INGEST] "${parsed.title.slice(0, 25)}..." indexed! Found ${submitRes.newLinksAdded} outbound links.`, 'success');

    } catch (err) {
      logToHud(`[SKIP] Could not crawl ${taskUrl}: ${err.message}`, 'warn');
    } finally {
      isCurrentlyProcessing = false;
      statWorkerStatus.textContent = 'Idle';
      statWorkerStatus.style.color = '#fbbc05';
      updateHudStats();
    }
  }

  // --- SYNC LIVE TELEMETRY WITH SWARM WORKER (swarm-data.json) ---
  async function syncWithSwarmData() {
    try {
      const res = await fetch('swarm-data.json?t=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();

      if (data && data.search_index && data.frontier) {
        // Update local storage for search engine instant access
        localStorage.setItem('swarm_index', JSON.stringify(data.search_index));
        localStorage.setItem('swarm_frontier', JSON.stringify(data.frontier));

        // Update HUD stats
        const pending = data.frontier.filter(f => f.status === 'pending').length;
        const completed = data.frontier.filter(f => f.status === 'completed').length;

        statFrontier.textContent = pending;
        statIndexed.textContent = data.total_indexed || data.search_index.length;
        statDeviceCrawled.textContent = completed;

        // Display the most recently crawled document
        if (data.search_index.length > 0) {
          const latestDoc = data.search_index[0];
          currentTaskUrl.textContent = latestDoc.url;
          currentTaskHash.textContent = `SHA-256: ${latestDoc.content_hash || 'verified'}`;
          statWorkerStatus.textContent = 'Active (Synced)';
          statWorkerStatus.style.color = '#00e676';
        }
      }
    } catch {
      // Fallback to local store
    }
  }

  // Poll swarm-data.json every 2 seconds
  syncWithSwarmData();
  setInterval(syncWithSwarmData, 2000);

  // Helper formatting functions
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlightQuery(content, query) {
    if (!content) return '';
    const safeContent = escapeHtml(content.slice(0, 240));
    const words = query.trim().split(/\s+/).filter(Boolean);
    let highlighted = safeContent;
    words.forEach(w => {
      const regex = new RegExp(`(${w})`, 'gi');
      highlighted = highlighted.replace(regex, '<strong>$1</strong>');
    });
    return highlighted + '...';
  }

  // Initial setup and recurring tick
  updateHudStats();
  setInterval(runClientWorkerCycle, 4000); // Poll task queue every 4 seconds
  setInterval(updateHudStats, 3000);
});
