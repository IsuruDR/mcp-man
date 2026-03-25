import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateState } from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ manager }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/servers', async (req, res) => {
    try {
      await manager.load();
      await manager.importFromConfig();
      const state = await manager.getState();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/servers', async (req, res) => {
    try {
      const errors = validateState(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('; ') });
      }
      await manager.save(req.body);
      const state = await manager.getState();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/import', async (req, res) => {
    try {
      await manager.load();
      await manager.importFromConfig();
      const state = await manager.getState();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/claude-ai-mcps', async (req, res) => {
    try {
      const connected = await manager.getConnectedClaudeAiMcps();
      res.json({ connected });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/projects', async (req, res) => {
    try {
      const state = await manager.getState();
      const paths = Object.keys(state?.servers?.projects || {});
      res.json({ projects: paths });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
