import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

const LOCAL_STATE_ROUTE = '/__local-state/save';
const LOCAL_STATE_FILE = path.resolve(process.cwd(), 'public/data/family-tree-state.json');

function localStateWriterPlugin() {
  return {
    name: 'local-state-writer',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== LOCAL_STATE_ROUTE) {
          next();
          return;
        }

        try {
          const body = await new Promise((resolve, reject) => {
            let raw = '';
            req.on('data', (chunk) => {
              raw += chunk;
            });
            req.on('end', () => resolve(raw));
            req.on('error', reject);
          });

          const payload = JSON.parse(body || '{}');
          await fs.mkdir(path.dirname(LOCAL_STATE_FILE), { recursive: true });
          await fs.writeFile(LOCAL_STATE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: 'public/data/family-tree-state.json' }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error?.message || 'Local save failed.' }));
        }
      });
    }
  };
}

export default defineConfig(({ command }) => ({
  plugins: command === 'serve' ? [localStateWriterPlugin()] : []
}));
