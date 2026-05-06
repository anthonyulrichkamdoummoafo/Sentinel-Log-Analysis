# Sentinel: Real-Time Cybersecurity Log Analysis System

This project is an end-to-end telemetry pipeline designed to detect cybersecurity threats in web server logs. It simulates a high-performance Spark/HDFS environment using Node.js stream processing and Python data generators.

## 🚀 Phase Overwrites & Architecture

### Phase 1: Data & Parsing
- **Static Source:** `nasa_sample.log` (Sample of the Kennedy Space Center dataset).
- **Dynamic Source:** `log_generator.py` simulates live Apache logs.
- **Parsing:** Implemented via high-speed Regex in the Express backend and Python batch script.

### Phase 2: Batch Analysis
- **HDFS Simulation:** Local file system storage.
- **Spark Simulation:** `batch_analysis.py` implements the aggregation logic (Top IPs, Hourly Volume, 404 filtering).

### Phase 3: Real-Time Streaming
- **Engine:** Node.js child_process + Stream extraction.
- **Windowing:** 60-second sliding window implemented in memory (`server.ts`).
- **Detectors:** 
  - **DDoS Detector:** Triggers if an IP exceeds 100 req/min.
  - **Probing Detector:** Triggers if an IP has >50% failure rate (404 errors).

### Phase 4: Visualization
- **Dashboard:** React-based dashboard with real-time charts using Recharts.
- **Features:** Live log feed, Threat alert sidebar, Status distribution, and Source IP tracking.

## 🛠 Setup & Execution

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Mode (Server + Frontend):**
   ```bash
   npm run dev
   ```
   *The Python log generator starts automatically as a subprocess.*

3. **Run Batch Analysis:**
   ```bash
   python3 batch_analysis.py
   ```

## 📊 Analysis of Attack Patterns (NASA Dataset Sample)

Based on the NASA dataset analysis, several patterns were identified:

1. **404 Probing:** Some IPs (like `129.94.144.152` in the sample) show consecutive 404 errors for assets like `/images/NASA-logosmall.gif`. This pattern often indicates a "broken link" crawl or an automated tool searching for misconfigured sensitive directories.
2. **Resource Exhaustion:** IPs like `d104.aa.net` request heavy binary assets (like `count.gif`) rapidly. In a real-world scenario, without rate limiting, this behavior scales into a Layer 7 DDoS attack.
3. **Status 304 Efficiency:** A high volume of 304 (Not Modified) responses suggests healthy caching, which protects the server from actual delivery load even during high traffic.

---
*Developed for the AI Studio Build Environment.*
