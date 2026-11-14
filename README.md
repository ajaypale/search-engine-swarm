# 🌐 SwarmSearch — Distributed Edge Search Engine

A high-performance, 100% client-side distributed search engine and web indexing swarm. In SwarmSearch, client devices at the edge perform the heavy lifting of web fetching, DOM parsing, noise stripping, and cryptographic SHA-256 fingerprinting.

---

## 🌍 Live Global Deployment

* **Public Web Search Engine:** **[https://pal-swarm-search.web.app](https://pal-swarm-search.web.app)**
* **Alternative Domain:** [https://pal-swarm-search.firebaseapp.com](https://pal-swarm-search.firebaseapp.com)
* **GitHub Repository:** [https://github.com/ajaypale/search-engine-swarm](https://github.com/ajaypale/search-engine-swarm)

---

## ⚡ Core Architecture

* **100% Client-Side Engine:** Built entirely in modern pure JavaScript (ES modules, Node.js v20+).
* **Zero Cloud Functions & Zero Third-Party Proxies:** Fetches directly via native HTTP with authentic browser headers, bypassing aggressive bot firewalls without external proxy services.
* **High-Priority Preemption Queue:** User-submitted websites immediately preempt background crawling and jump to Worker Slot #1.
* **Append-Only Streaming Storage (`search-index.jsonl`):** Constant-memory streaming index that scales to hundreds of thousands of documents without V8 heap exhaustion.
* **Bounded In-Memory Frontier:** Strict RAM guards keep memory consumption under 100 MB at 400+ pages/minute.
* **Cryptographic Verification:** Every indexed document is assigned a unique SHA-256 fingerprint for tamper-proof validation.
* **Swarm AI Overview:** Client-side synthesis engine generates multi-source AI summaries with interactive citation pills.

---

## 🚀 Quick Start & Deployment

### 1. Prerequisites
* **Node.js** v20.0.0 or higher
* Modern web browser (Chrome, Chromium, Firefox)

### 2. Deploy Locally
Clone or open the workspace and launch the orchestrator:

```bash
# Install dependencies (zero external packages required - native Node.js)
npm install

# Deploy both the Web Server and Crawler Worker Daemon
npm start
```

### 3. Endpoints & Access
Once deployed, the orchestrator exposes:

* **Web Search Portal:** [http://127.0.0.1:8080/index.html](http://127.0.0.1:8080/index.html)
* **Search API:** `GET http://127.0.0.1:8080/api/search?q=:query`
* **Priority Submission API:** `POST http://127.0.0.1:8080/api/submit` with JSON `{ "url": "https://example.com" }`
* **Swarm Telemetry:** `GET http://127.0.0.1:8080/api/status`

---

## 📁 Repository Structure

```text
├── deploy.js               # Production deployment orchestrator & process monitor
├── server.js               # Native HTTP server, Static Host & Fast Search API (Port 8080)
├── swarm-worker.js         # N=8 parallel crawler worker with priority preemption
├── index.html              # Search engine portal & live Swarm HUD dock
├── style.css               # Clean Google-inspired search & telemetry interface
├── app.js                  # Frontend search controller & AI summary engine
├── firebase-config.js      # Storage and synchronization abstraction
├── swarm-data.json         # Live telemetry snapshot and recent search index
├── manifest.json           # Web application manifest
└── package.json            # Node.js project manifest & scripts
```

---

## 🔒 Security & Anti-Bot Strategy
* Uses native Node.js HTTP/2 and fetch with realistic browser TLS signatures.
* Strips synthetic scraper headers (`Sec-Ch-Ua`, custom proxies) to prevent triggering Cloudflare/Akamai bot detection.
* Strict asset sanitization strips binary files (`.css`, `.png`, `.jpg`, `.woff2`) and media CDN domains before frontier insertion.

---

## 📄 License
MIT License. Open-source distributed computing research.
