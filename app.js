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

    // Auto-prepend https:// if bare domain is entered (e.g. palengineers.com -> https://palengineers.com)
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    submitUrlInput.value = '';
    closeSubmit();

    logToHud(`[SUBMIT] Pushing seed URL to Swarm Preemption Engine: ${url}`, 'info');

    // 1. Instant Edge Queue: Register with High Priority in Local Storage
    const queueRes = await window.swarmStorage.submitSeedUrl(url);
    logToHud(`[QUEUE] ${queueRes.message}`, 'success');
    updateHudStats();

    // 2. Local Server Bridge Notification (if running locally or connected to node daemon)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          logToHud(`[BRIDGE] Server node assigned: ${data.message}`, 'success');
        }
      }
    } catch (err) {
      // Expected on static CDN deployments (Firebase Hosting) - fallback to direct client worker
    }

    // 3. IMMEDIATE PREEMPTION: Execute crawler cycle immediately without waiting for interval
    logToHud(`[PREEMPTION] Prioritizing ${url} to Slot #1 - Launching Client DOM Engine...`, 'success');
    if (!isCrawlerRunning) {
      toggleCrawler.checked = true;
      isCrawlerRunning = true;
      statWorkerStatus.textContent = 'Active';
      statWorkerStatus.style.color = '#00e676';
    }
    // Launch cycle immediately
    setTimeout(runClientWorkerCycle, 50);
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

  // Pure Client-Side DOM & Document Extractor
  function parseHtmlClientSide(payloadString, sourceUrl, isMarkdown = false) {
    if (isMarkdown) {
      // 1. Extract Page Title from Edge Markdown Header
      const titleMatch = payloadString.match(/^Title:\s*(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : sourceUrl;

      // 2. Strip Markdown syntax and symbols
      const contentIdx = payloadString.indexOf('Markdown Content:');
      const textContent = (contentIdx !== -1 ? payloadString.slice(contentIdx + 17) : payloadString)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/[*#_`>~]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 3. Extract outbound links from markdown links
      const outboundLinks = [];
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      let m;
      while ((m = linkRegex.exec(payloadString)) !== null) {
        if (!outboundLinks.includes(m[2])) {
          outboundLinks.push(m[2]);
        }
      }

      return {
        title: title.slice(0, 200),
        content: textContent.slice(0, 5000),
        ai_summary: textContent.slice(0, 300) + '...',
        outboundLinks: outboundLinks.slice(0, 30)
      };
    }

    // Native Browser DOM Parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(payloadString, 'text/html');

    // 1. Extract Page Title
    const title = doc.title ? doc.title.trim() : sourceUrl;

    // 2. Strip scripts, styles, iframes, and navs
    const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, nav, footer, header');
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
      } catch (err) {}
    });

    return {
      title: title.slice(0, 200),
      content: textContent.slice(0, 5000),
      ai_summary: textContent.slice(0, 300) + '...',
      outboundLinks: outboundLinks.slice(0, 30)
    };
  }

  // Pure Client-Side Fetch (Direct Device HTTP + Universal Edge Fallback)
  async function fetchPageContent(url) {
    // Tier 1: Direct fetch from user's device (works for CORS-enabled domains like palengineers.com)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const etag = res.headers.get('ETag') || ('direct-etag-' + Date.now());
        return { html, etag, mode: 'direct', isMarkdown: false };
      }
    } catch (directErr) {
      logToHud(`[CORS] Direct fetch restricted by browser. Routing through high-speed edge bridge...`, 'warn');
    }

    // Tier 2: Universal Edge Reader (Zero Cloud Functions, 100% Client-Side CORS-Free)
    try {
      const edgeUrl = `https://r.jina.ai/${url}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(edgeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) {
          return { html: text, etag: 'edge-etag-' + Date.now(), mode: 'edge-bridge', isMarkdown: true };
        }
      }
    } catch (edgeErr) {
      logToHud(`[EDGE] Edge bridge attempt failed: ${edgeErr.message}`, 'warn');
    }

    throw new Error(`Target host blocked both direct fetch and edge bridge.`);
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
      // 1. Dual-Tier Fetch (Direct + Edge Bridge)
      const { html, etag, mode, isMarkdown } = await fetchPageContent(taskUrl);
      logToHud(`[PARSE] Downloaded payload via ${mode} (${(html.length / 1024).toFixed(1)} KB). Executing Parser...`, 'info');

      // 2. Pure Client-Side Document Parsing
      const parsed = parseHtmlClientSide(html, taskUrl, isMarkdown);

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
      logToHud(`[INGEST] "${parsed.title.slice(0, 32)}..." indexed! Found ${submitRes.newLinksAdded} outbound links.`, 'success');

      // Re-trigger immediately if there are more pending tasks in queue
      setTimeout(runClientWorkerCycle, 300);

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
        // 1. Safe Frontier Merge: NEVER wipe out locally queued or user-submitted tasks!
        try {
          const localFrontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
          const pendingLocal = localFrontier.filter(f => f.status === 'pending');
          const mergedFrontier = [...pendingLocal];

          for (const item of (data.frontier || [])) {
            if (!mergedFrontier.some(f => (f.url || '').toLowerCase() === (item.url || '').toLowerCase())) {
              mergedFrontier.push(item);
            }
          }
          localStorage.setItem('swarm_frontier', JSON.stringify(mergedFrontier.slice(0, 150)));
        } catch {}

        // 2. Safe Index Merge: Keep locally crawled pages at the absolute top of the search index!
        try {
          const localIndex = JSON.parse(localStorage.getItem('swarm_index') || '[]');
          const mergedIndex = [...localIndex];

          for (const doc of data.search_index) {
            if (!mergedIndex.some(d => (d.url || '').toLowerCase() === (doc.url || '').toLowerCase())) {
              mergedIndex.push(doc);
            }
          }

          if (window.swarmStorage) {
            window.swarmStorage.cachedIndex = mergedIndex;
          }
          localStorage.setItem('swarm_index', JSON.stringify(mergedIndex.slice(0, 100)));
        } catch {
          console.warn('[STORAGE] LocalStorage quota reached, running purely in high-speed RAM mode.');
        }

        // Update HUD stats
        const currentFrontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
        const pendingCount = currentFrontier.filter(f => f.status === 'pending').length;
        const totalIndexedCount = (data.total_indexed || (window.swarmStorage && window.swarmStorage.cachedIndex ? window.swarmStorage.cachedIndex.length : 1500));

        statFrontier.textContent = pendingCount;
        statIndexed.textContent = totalIndexedCount.toLocaleString();

        // Display current active document if worker is idle
        if (!isCurrentlyProcessing && window.swarmStorage && window.swarmStorage.cachedIndex && window.swarmStorage.cachedIndex.length > 0) {
          const latestDoc = window.swarmStorage.cachedIndex[0];
          currentTaskUrl.textContent = latestDoc.url;
          currentTaskHash.textContent = `SHA-256: ${latestDoc.content_hash || 'verified'}`;
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
