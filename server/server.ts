import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { aiService } from './aiService';
import { permissionEngine } from './permissionEngine';
import { auditService } from './auditService';
import { memoryService } from './memoryService';
import { toolsService } from './toolsService';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Configure CORS for local network and localhost access
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow localhost, 127.0.0.1, private LAN IPv4 ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x), capacitor://
    const isAllowed =
      /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin) ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('http://localhost');

    if (isAllowed) {
      return callback(null, true);
    }

    // Default permit for local development command center
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health / Status
app.get('/api/status', (req, res) => {
  const modelStatus = aiService.getModelStatus();
  const pendingRequests = permissionEngine.getPendingRequests();
  const fileCount = toolsService.listFiles().length;

  res.json({
    status: 'ONLINE',
    version: '1.0.0',
    model: modelStatus,
    pendingConfirmations: pendingRequests,
    sandboxFilesCount: fileCount,
    timestamp: Date.now(),
  });
});

// Primary Command Dispatcher (Voice / Text)
app.post('/api/command', async (req, res) => {
  try {
    const { command, history } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command string is required.' });
    }

    // Emergency STOP keyword check in voice/text
    const trimmed = command.trim().toUpperCase();
    if (trimmed === 'STOP' || trimmed === 'CANCEL' || trimmed === 'ABORT' || trimmed === 'ULTRON STOP') {
      permissionEngine.abortAll();
      auditService.record({
        name: 'emergency_stop',
        args: { trigger: command },
        permissionLevel: 1,
        status: 'ABORTED',
        originatingCommand: command,
      });

      return res.json({
        textResponse: 'Emergency STOP acknowledged. All pending operations have been immediately terminated.',
        toolCallsExecuted: [],
        status: 'STOPPED',
        modelUsed: 'Ultron Safety Interlock',
      });
    }

    const result = await aiService.processCommand(command, history || []);
    res.json(result);
  } catch (err: any) {
    console.error('[Server] /api/command error:', err);
    res.status(500).json({
      error: err.message || 'Internal processing error',
      textResponse: `Execution error encountered: ${err.message}`,
    });
  }
});

// Confirmation Approval (Voice, Button, or Gesture)
app.post('/api/confirm', async (req, res) => {
  try {
    const { approvalId, approved } = req.body;
    if (!approvalId) {
      return res.status(400).json({ error: 'approvalId is required.' });
    }

    const resolution = await permissionEngine.resolveApproval(approvalId, !!approved);
    res.json(resolution);
  } catch (err: any) {
    console.error('[Server] /api/confirm error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Emergency STOP
app.post('/api/stop', (req, res) => {
  permissionEngine.abortAll();
  auditService.record({
    name: 'emergency_stop',
    args: { source: 'ui_button' },
    permissionLevel: 1,
    status: 'ABORTED',
    originatingCommand: 'EMERGENCY_STOP_BUTTON',
  });

  res.json({
    success: true,
    message: 'All operations aborted. System returned to IDLE state.',
  });
});

// Audit Activity Feed
app.get('/api/audit', (req, res) => {
  const records = auditService.getRecords(40);
  res.json(records);
});

// Clear Audit Activity
app.post('/api/audit/clear', (req, res) => {
  auditService.clear();
  res.json({ success: true });
});

// Memory endpoints
app.get('/api/memory', (req, res) => {
  res.json(memoryService.getAll());
});

app.post('/api/memory', (req, res) => {
  const { key, value, category } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required.' });
  }
  const item = memoryService.remember(key, value, category || 'fact');
  res.json(item);
});

app.delete('/api/memory/:id', (req, res) => {
  const deleted = memoryService.forget(req.params.id);
  res.json({ success: deleted });
});

// Sandbox File Explorer
app.get('/api/files', (req, res) => {
  try {
    const files = toolsService.listFiles();
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download Sandbox File
app.get('/api/files/download', (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).send('File path is required');
    }
    const fullPath = path.resolve(process.cwd(), process.env.SANDBOX_PATH || './sandbox', filePath.replace(/^[/\\]+/, ''));
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('File not found');
    }
    res.download(fullPath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// Direct APK Download endpoint
app.get(['/download/ULTRON.apk', '/ULTRON.apk'], (req, res) => {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'ULTRON.apk'),
      path.resolve(__dirname, '../ULTRON.apk'),
      path.resolve(__dirname, 'ULTRON.apk'),
      path.resolve(process.cwd(), 'android/app/build/outputs/apk/debug/ULTRON.apk'),
      path.resolve(process.cwd(), 'android/app/build/outputs/apk/debug/app-debug.apk')
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return res.download(p, 'ULTRON.apk', (err) => {
          if (err && !res.headersSent) {
            console.error('[Download] Error sending file:', err);
            res.status(500).send(`Error downloading APK: ${err.message}`);
          }
        });
      }
    }

    res.status(404).json({
      error: 'APK not found. Please run assembleDebug first.',
      checkedPaths: candidatePaths,
      cwd: process.cwd(),
      dir: __dirname
    });
  } catch (err: any) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Vision Frame Analysis
app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image base64 data required' });
    }
    const analysis = await aiService.analyzeImage(image, prompt || 'Analyze this camera frame for objects, text, and scene');
    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Update
app.post('/api/settings', (req, res) => {
  const { apiKey, model } = req.body;
  if (apiKey !== undefined) {
    aiService.updateConfig(apiKey, model);
  }
  res.json({
    success: true,
    status: aiService.getModelStatus(),
  });
});

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

app.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`====================================================`);
  console.log(` ULTRON COMMAND CENTER BACKEND SERVER ACTIVE`);
  console.log(` Local:   http://localhost:${PORT}`);
  console.log(` Network: http://${lanIp}:${PORT}`);
  console.log(` Primary Intelligence Target: ${aiService.primaryModel}`);
  console.log(` Model Status: ${aiService.getModelStatus().status}`);
  console.log(`====================================================`);
});
