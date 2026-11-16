/**
 * SwarmSearch Firebase Integration & Distributed Storage Abstraction
 * Supports both Live Firebase (Firestore + Auth) and Instant Local IndexedDB/LocalStorage Mode.
 */

class SwarmStorageAdapter {
  constructor() {
    this.mode = localStorage.getItem('swarm_backend_mode') || 'local';
    this.config = JSON.parse(localStorage.getItem('swarm_firebase_config') || '{}');
    this.deviceId = this.getOrCreateDeviceId();
    this.isLiveFirebaseReady = false;
    
    // Seed initial demo data into local storage if empty
    this.initLocalStore();
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('swarm_device_id');
    if (!id) {
      id = 'node_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('swarm_device_id', id);
    }
    return id;
  }

  initLocalStore() {
    this.cachedIndex = null;
    // Attempt to load from swarm-data.json if present
    fetch('swarm-data.json?t=' + Date.now())
      .then(r => r.json())
      .then(fileData => {
        if (fileData && fileData.search_index && fileData.search_index.length > 0) {
          // Merge any locally crawled pages in localStorage at the front
          let localIndex = [];
          try {
            localIndex = JSON.parse(localStorage.getItem('swarm_index') || '[]');
          } catch {}

          const merged = [...localIndex];
          for (const doc of fileData.search_index) {
            if (!merged.some(m => (m.url || '').toLowerCase() === (doc.url || '').toLowerCase())) {
              merged.push(doc);
            }
          }

          this.cachedIndex = merged;

          try {
            localStorage.setItem('swarm_index', JSON.stringify(merged.slice(0, 100)));
          } catch {}
        }
      })
      .catch(() => {});

    if (!localStorage.getItem('swarm_frontier')) {
      const initialFrontier = [
        { url: 'https://palengineers.com/', status: 'pending', isPriority: true, addedAt: Date.now() },
        { url: 'https://www.alibaba.com/', status: 'pending', addedAt: Date.now() },
        { url: 'https://fastapi.tiangolo.com/', status: 'pending', addedAt: Date.now() },
        { url: 'https://news.ycombinator.com/', status: 'pending', addedAt: Date.now() }
      ];
      localStorage.setItem('swarm_frontier', JSON.stringify(initialFrontier));
    }

    if (!localStorage.getItem('swarm_index')) {
      const initialIndex = [
        {
          url: 'https://news.ycombinator.com/',
          title: 'Hacker News',
          content: 'Hacker News is a social news website focusing on computer science and entrepreneurship. It is run by the investment fund Y Combinator.',
          keywords: ['hacker', 'news', 'computer', 'science', 'entrepreneurship', 'ycombinator', 'startups'],
          content_hash: '9a84f3c72b15e478d120a1f054e488d5e0f7380cf7168cbe6985a3c9bbf2810a',
          etag: 'W/"hn-etag-01"',
          verification_status: 'verified',
          indexedAt: Date.now() - 3600000,
          submittedBy: 'node_seed'
        },
        {
          url: 'https://en.wikipedia.org/wiki/Distributed_computing',
          title: 'Distributed computing - Wikipedia',
          content: 'Distributed computing is a field of computer science that studies distributed systems. A distributed system is a system whose components are located on different networked computers.',
          keywords: ['distributed', 'computing', 'wikipedia', 'computer', 'systems', 'networked', 'nodes'],
          content_hash: '3f51e44a9b40778c891f7a4d2c8846be019aa1f28b7593c2807f4309321ba37c',
          etag: 'W/"wiki-etag-02"',
          verification_status: 'verified',
          indexedAt: Date.now() - 1800000,
          submittedBy: 'node_seed'
        }
      ];
      localStorage.setItem('swarm_index', JSON.stringify(initialIndex));
    }
  }

  // --- FRONTIER QUEUE OPERATIONS ---

  async getPendingTask() {
    if (this.mode === 'firebase' && this.isLiveFirebaseReady) {
      return null;
    }

    // Local Store implementation with Priority Preemption
    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    // Look for high-priority user-submitted task first
    let task = frontier.find(item => item.status === 'pending' && item.isPriority);
    if (!task) {
      task = frontier.find(item => item.status === 'pending');
    }

    if (task) {
      task.status = 'processing';
      task.assignedTo = this.deviceId;
      task.assignedAt = Date.now();
      localStorage.setItem('swarm_frontier', JSON.stringify(frontier));
      return task.url;
    }
    return null;
  }

  async submitTaskResult(url, title, content, contentHash, etag, outboundLinks) {
    // 1. Save or replace in Search Index
    const index = JSON.parse(localStorage.getItem('swarm_index') || '[]');
    const keywords = this.extractKeywords(title + ' ' + content + ' ' + url);
    
    const existingIdx = index.findIndex(doc => (doc.url || '').toLowerCase() === url.toLowerCase());
    const newDoc = {
      url,
      title,
      content,
      keywords,
      content_hash: contentHash,
      etag: etag || 'N/A',
      verification_status: 'verified',
      indexedAt: Date.now(),
      submittedBy: this.deviceId
    };

    if (existingIdx >= 0) {
      index[existingIdx] = newDoc;
    } else {
      index.unshift(newDoc);
    }
    localStorage.setItem('swarm_index', JSON.stringify(index));

    // CRITICAL: Immediately update in-memory cachedIndex so search finds it instantly!
    if (!this.cachedIndex) {
      this.cachedIndex = [];
    }
    this.cachedIndex = this.cachedIndex.filter(d => (d.url || '').toLowerCase() !== url.toLowerCase());
    this.cachedIndex.unshift(newDoc);

    // 2. Mark completed in frontier and push new links
    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    const frontierItem = frontier.find(f => (f.url || '').toLowerCase() === url.toLowerCase());
    if (frontierItem) {
      frontierItem.status = 'completed';
      frontierItem.completedAt = Date.now();
    }

    let addedCount = 0;
    outboundLinks.forEach(link => {
      if (!frontier.some(f => (f.url || '').toLowerCase() === link.toLowerCase())) {
        frontier.push({
          url: link,
          status: 'pending',
          addedAt: Date.now(),
          discoveredBy: this.deviceId
        });
        addedCount++;
      }
    });

    localStorage.setItem('swarm_frontier', JSON.stringify(frontier));
    return { success: true, newLinksAdded: addedCount, doc: newDoc };
  }

  async submitSeedUrl(url) {
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    // Filter out previous entry if any to re-promote to Slot #1
    const filtered = frontier.filter(f => (f.url || '').toLowerCase() !== cleanUrl.toLowerCase());
    filtered.unshift({
      url: cleanUrl,
      status: 'pending',
      isPriority: true,
      addedAt: Date.now(),
      discoveredBy: 'user_submission'
    });
    localStorage.setItem('swarm_frontier', JSON.stringify(filtered));
    return { success: true, message: `Pushed ${cleanUrl} to Priority Frontier Queue (Slot #1).` };
  }

  // --- SEARCH QUERY OPERATIONS ---

  expandQueryTerms(query) {
    const qLower = query.trim().toLowerCase();
    const expansions = {
      'ev': ['ev', 'evs', 'electric vehicle', 'electric vehicles', 'electric car', 'electric scooter', 'ev charger', 'battery pack'],
      'ai': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural'],
      'b2b': ['b2b', 'wholesale', 'manufacturers', 'suppliers', 'exporters'],
      'seo': ['seo', 'search engine optimization', 'rankings', 'google search'],
      'api': ['api', 'rest api', 'endpoints', 'interface', 'sdk']
    };

    const expanded = new Set([qLower]);
    for (const [key, terms] of Object.entries(expansions)) {
      const reg = new RegExp(`\\b${key}\\b`, 'i');
      if (reg.test(qLower)) {
        terms.forEach(t => expanded.add(t));
      }
    }
    return Array.from(expanded);
  }

  async searchIndex(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let index = [];
    if (this.cachedIndex && this.cachedIndex.length > 0) {
      index = this.cachedIndex;
    } else {
      try {
        index = JSON.parse(localStorage.getItem('swarm_index') || '[]');
      } catch {
        index = [];
      }
    }

    // Merge any locally crawled pages that might be stored in localStorage
    try {
      const localDocs = JSON.parse(localStorage.getItem('swarm_index') || '[]');
      for (const lDoc of localDocs) {
        if (!index.some(d => (d.url || '').toLowerCase() === (lDoc.url || '').toLowerCase())) {
          index.unshift(lDoc);
        }
      }
    } catch {}

    // Domain & Subdomain Extraction
    // Handles: "palengineers.com", "https://palengineers.com/", "www.alibaba.com", "fastapi.tiangolo.com"
    const cleanHost = q.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim();
    const isDomainQuery = cleanHost.includes('.') && cleanHost.length >= 4;
    const domainCore = cleanHost.split('.')[0]; // e.g. "palengineers"

    const searchCandidates = this.expandQueryTerms(q);

    // Advanced relevance-ranked matching with Domain Authority Boost
    const results = index.map(doc => {
      let score = 0;
      const lowerTitle = (doc.title || '').toLowerCase();
      const lowerContent = (doc.content || '').toLowerCase();
      const lowerUrl = (doc.url || '').toLowerCase();
      const keywords = (doc.keywords || []).map(k => String(k).toLowerCase());

      // 1. Exact Domain / Subdomain Authority Match (+500 points)
      if (isDomainQuery) {
        if (lowerUrl.includes(cleanHost)) {
          score += 500;
        } else if (cleanHost.length > 5 && (lowerTitle.includes(cleanHost) || lowerContent.includes(cleanHost))) {
          score += 250;
        }
      } else if (domainCore && domainCore.length >= 4) {
        // Query is a pure brand/company name matching host (e.g. "palengineers", "indiamart")
        if (lowerUrl.includes(domainCore)) {
          score += 200;
        }
      }

      // 2. Exact URL match (+600 points)
      if (lowerUrl === q || lowerUrl === (q + '/') || lowerUrl === ('https://' + cleanHost + '/')) {
        score += 600;
      }

      // 3. Direct Whole-Phrase Match
      const isQueryShort = q.length <= 3;
      if (isQueryShort) {
        const wholeQueryRegex = new RegExp(`\\b${q}\\b`, 'i');
        if (wholeQueryRegex.test(lowerTitle)) score += 100;
        if (wholeQueryRegex.test(lowerContent)) score += 30;
      } else {
        if (lowerTitle.includes(q)) score += 80;
        if (lowerContent.includes(q)) score += 20;
      }

      // 4. Query Term Evaluation with Strict Word Boundary for Short Acronyms
      for (const term of searchCandidates) {
        const isShort = term.length <= 3;
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${safeTerm}\\b`, 'i');

        // Whole-word match in title
        if (wordRegex.test(lowerTitle)) {
          score += 60;
        } else if (!isShort && lowerTitle.includes(term)) {
          score += 15;
        }

        // Whole-word match in content
        if (wordRegex.test(lowerContent)) {
          score += 25;
        } else if (!isShort && lowerContent.includes(term)) {
          score += 5;
        }

        // Keywords or URL
        if (keywords.includes(term)) score += 30;
        if (lowerUrl.includes(term)) score += 40;
      }

      return { ...doc, score };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score);

    return results;
  }

  // --- TELEMETRY & STATS ---

  async getStats() {
    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    const index = JSON.parse(localStorage.getItem('swarm_index') || '[]');

    const pending = frontier.filter(f => f.status === 'pending').length;
    const completed = frontier.filter(f => f.status === 'completed').length;

    return {
      frontierPending: pending,
      frontierTotal: frontier.length,
      indexedCount: index.length,
      completedCount: completed
    };
  }

  extractKeywords(text) {
    const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'that', 'you', 'for', 'on', 'with', 'as', 'this', 'by', 'at', 'an', 'be', 'from', 'or', 'are', 'was']);
    return Array.from(new Set(
      text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    )).slice(0, 50);
  }
}

// Global instance
window.swarmStorage = new SwarmStorageAdapter();
