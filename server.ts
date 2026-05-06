import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // --- LOG PROCESSING LOGIC ---
  
  interface LogEntry {
    ip: string;
    timestamp: string;
    method: string;
    path: string;
    status: number;
    bytes: number;
    raw: string;
  }

  interface Alert {
    id: string;
    type: 'DDOS' | 'PROBING';
    ip: string;
    message: string;
    timestamp: number;
  }

  const logBuffer: LogEntry[] = [];
  const alerts: Alert[] = [];
  const blockedIps = new Set<string>();
  
  // Sliding window storage: IP -> [Timestamps]
  const requestWindows = new Map<string, number[]>();
  const errorWindows = new Map<string, { total: number, errors: number, ts: number }[]>();

  const WINDOW_SIZE_MS = 60000; // 60 seconds
  const DDOS_THRESHOLD = 100;
  const PROBING_THRESHOLD_RATE = 0.5; // 50%
  const PROBING_MIN_REQUESTS = 10;

  let logCounter = 0;
  function parseLogLine(line: string): LogEntry | null {
    // Regex for Apache/Nginx logs: ip - - [ts] "method path protocol" status bytes
    const regex = /^(\S+) - - \[(.*?)\] "(.*?) (.*?) (.*?)" (\d+) (\d+)$/;
    const match = line.match(regex);
    if (!match) return null;

    logCounter++;
    return {
      id: `${Math.random().toString(36).substr(2, 9)}-${Date.now()}-${logCounter}`,
      ip: match[1],
      timestamp: match[2],
      method: match[3],
      path: match[4],
      status: parseInt(match[6]),
      bytes: parseInt(match[7]),
      raw: line
    };
  }

  function processLog(entry: LogEntry) {
    if (blockedIps.has(entry.ip)) return; // Ignore traffic from blocked IPs

    const now = Date.now();
    
    // Update log buffer for frontend (keep last 50)
    logBuffer.push(entry);
    if (logBuffer.length > 50) logBuffer.shift();

    // 1. DDoS Detection
    if (!requestWindows.has(entry.ip)) requestWindows.set(entry.ip, []);
    const userWindow = requestWindows.get(entry.ip)!;
    userWindow.push(now);
    
    const filteredWindow = userWindow.filter(ts => now - ts < WINDOW_SIZE_MS);
    requestWindows.set(entry.ip, filteredWindow);

    if (filteredWindow.length > DDOS_THRESHOLD) {
      const alertId = `ddos-${entry.ip}-${Math.floor(now/5000)}`;
      if (!alerts.some(a => a.id === alertId)) {
        const alert: Alert = {
          id: alertId,
          type: 'DDOS',
          ip: entry.ip,
          message: `High traffic volume detected from ${entry.ip} (${filteredWindow.length} req/min)`,
          timestamp: now
        };
        alerts.unshift(alert);
        if (alerts.length > 50) alerts.pop();
        io.emit('new_alert', alert);
      }
    }

    // 2. Probing Detection (404 rate per IP)
    if (!errorWindows.has(entry.ip)) errorWindows.set(entry.ip, []);
    const errWindow = errorWindows.get(entry.ip)!;
    errWindow.push({ total: 1, errors: entry.status === 404 ? 1 : 0, ts: now });
    
    const filteredErrWindow = errWindow.filter(item => now - item.ts < WINDOW_SIZE_MS);
    errorWindows.set(entry.ip, filteredErrWindow);

    const totalReqs = filteredErrWindow.length;
    if (totalReqs >= PROBING_MIN_REQUESTS) {
      const totalErrors = filteredErrWindow.reduce((acc, item) => acc + item.errors, 0);
      const errorRate = totalErrors / totalReqs;

      if (errorRate > PROBING_THRESHOLD_RATE) {
        const alertId = `probing-${entry.ip}-${Math.floor(now/5000)}`;
        if (!alerts.some(a => a.id === alertId)) {
          const alert: Alert = {
            id: alertId,
            type: 'PROBING',
            ip: entry.ip,
            message: `Potential probing detected from ${entry.ip} (${(errorRate * 100).toFixed(1)}% 404 rate)`,
            timestamp: now
          };
          alerts.unshift(alert);
          if (alerts.length > 50) alerts.pop();
          io.emit('new_alert', alert);
        }
      }
    }

    io.emit('log_update', entry);
  }

  // --- API ROUTES ---

  app.use(express.json());

  app.get('/api/stats', (req, res) => {
    const topIps = Array.from(requestWindows.entries())
      .map(([ip, window]) => ({ ip, count: window.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const statusDist = logBuffer.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    res.json({
      recentLogs: logBuffer,
      alerts,
      topIps,
      statusDist,
      blockedIps: Array.from(blockedIps)
    });
  });

  app.post('/api/quarantine', (req, res) => {
    const { ip } = req.body;
    if (ip) {
      blockedIps.add(ip);
      io.emit('system_message', { type: 'BLOCK', ip, message: `IP ${ip} has been added to restricted list.` });
      res.json({ success: true, message: `IP ${ip} blocked.` });
    } else {
      res.status(400).json({ error: 'Missing IP' });
    }
  });

  app.post('/api/investigate', async (req, res) => {
    const { alert } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured." });
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/genai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const logsForIp = logBuffer.filter(l => l.ip === alert.ip).map(l => l.raw).join('\n');
      
      const prompt = `
        You are a cybersecurity expert. Analyze the following logs and the alert generated for IP ${alert.ip}.
        
        ALERT TYPE: ${alert.type}
        ALERT MESSAGE: ${alert.message}
        
        LOG CONTEXT:
        ${logsForIp || "No specific log history available for this IP."}
        
        Provide a concise investigation report in markdown format including:
        1. Attack assessment (True Positive vs False Positive)
        2. Threat level (Low/Medium/High/Critical)
        3. Recommended Actions (specific to this type of traffic)
        Keep it professional and technical.
      `;

      const result = await model.generateContent(prompt);
      res.json({ analysis: result.response.text() });
    } catch (err) {
      console.error("AI Investigation error:", err);
      res.status(500).json({ error: "Failed to perform AI analysis." });
    }
  });

  // --- START LOG GENERATOR ---
  
  try {
    const pythonProcess = spawn('python3', [path.join(__dirname, 'log_generator.py')]);

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const entry = parseLogLine(line);
        if (entry) {
          processLog(entry);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Log generator process exited with code ${code}`);
    });
  } catch (err) {
    console.error("Failed to start log generator:", err);
  }

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
