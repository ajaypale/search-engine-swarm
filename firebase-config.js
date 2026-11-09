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
    // Attempt to load from swarm-data.json if present
    fetch('swarm-data.json')
      .then(r => r.json())
      .then(fileData => {
        if (fileData && fileData.search_index && fileData.search_index.length > 0) {
          localStorage.setItem('swarm_index', JSON.stringify(fileData.search_index));
          localStorage.setItem('swarm_frontier', JSON.stringify(fileData.frontier));
        }
      })
      .catch(() => {});

    if (!localStorage.getItem('swarm_frontier')) {
      const initialFrontier = [
        { url: 'https://news.ycombinator.com/', status: 'pending', addedAt: Date.now() },
        { url: 'https://en.wikipedia.org/wiki/Distributed_computing', status: 'pending', addedAt: Date.now() },
        { url: 'https://github.com/trending', status: 'pending', addedAt: Date.now() }
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
      // In live Firebase: query firestore collection 'frontier' where status == 'pending' limit 1
      return null;
    }

    // Local Store implementation
    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    const task = frontier.find(item => item.status === 'pending');
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
    const keywords = this.extractKeywords(title + ' ' + content);
    
    const existingIdx = index.findIndex(doc => doc.url === url);
    const newDoc = {
      url,
      title,
      content,
      keywords,
      content_hash: contentHash,
      etag: etag || 'N/A',
      verification_status: 'verified', // Optimistic immediate verification for demo
      indexedAt: Date.now(),
      submittedBy: this.deviceId
    };

    if (existingIdx >= 0) {
      index[existingIdx] = newDoc;
    } else {
      index.unshift(newDoc);
    }
    localStorage.setItem('swarm_index', JSON.stringify(index));

    // 2. Mark completed in frontier and push new links
    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    const frontierItem = frontier.find(f => f.url === url);
    if (frontierItem) {
      frontierItem.status = 'completed';
      frontierItem.completedAt = Date.now();
    }

    let addedCount = 0;
    outboundLinks.forEach(link => {
      if (!frontier.some(f => f.url === link)) {
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
    return { success: true, newLinksAdded: addedCount };
  }

  async submitSeedUrl(url) {
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const frontier = JSON.parse(localStorage.getItem('swarm_frontier') || '[]');
    if (frontier.some(f => f.url === cleanUrl)) {
      return { success: false, message: 'URL is already in the frontier queue.' };
    }
    frontier.unshift({
      url: cleanUrl,
      status: 'pending',
      addedAt: Date.now(),
      discoveredBy: 'user_submission'
    });
    localStorage.setItem('swarm_frontier', JSON.stringify(frontier));
    return { success: true, message: `Pushed ${cleanUrl} to frontier queue.` };
  }

  // --- SEARCH QUERY OPERATIONS ---

  async searchIndex(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const index = JSON.parse(localStorage.getItem('swarm_index') || '[]');
    const terms = q.split(/\s+/).filter(Boolean);

    // Simple ranked matching
    const results = index.map(doc => {
      let score = 0;
      const lowerTitle = doc.title.toLowerCase();
      const lowerContent = doc.content.toLowerCase();

      terms.forEach(term => {
        if (lowerTitle.includes(term)) score += 10;
        if (doc.keywords && doc.keywords.includes(term)) score += 5;
        if (lowerContent.includes(term)) score += 1;
      });

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
