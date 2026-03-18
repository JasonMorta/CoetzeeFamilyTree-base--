import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

const LOCAL_STATE_ROUTE = '/__local-state/save';
const LOCAL_CONFIG_FILE = path.resolve(process.cwd(), 'public/data/familytree.config.json');
const LOCAL_SAVED_PEOPLE_FILE = path.resolve(process.cwd(), 'public/data/savedPeople.json');
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
          const configPayload = payload.configPayload || payload;
          const savedPeoplePayload = payload.savedPeoplePayload || {
            meta: configPayload.meta || {},
            data: { savedPeople: configPayload?.data?.savedPeople || [] }
          };
          const legacyCombinedPayload = payload.legacyCombinedPayload || payload;

          await fs.mkdir(path.dirname(LOCAL_CONFIG_FILE), { recursive: true });
          await Promise.all([
            fs.writeFile(LOCAL_CONFIG_FILE, `${JSON.stringify(configPayload, null, 2)}\n`, 'utf8'),
            fs.writeFile(LOCAL_SAVED_PEOPLE_FILE, `${JSON.stringify(savedPeoplePayload, null, 2)}\n`, 'utf8'),
            fs.writeFile(LOCAL_STATE_FILE, `${JSON.stringify(legacyCombinedPayload, null, 2)}\n`, 'utf8')
          ]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            paths: [
              'public/data/familytree.config.json',
              'public/data/savedPeople.json',
              'public/data/family-tree-state.json'
            ]
          }));
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
  plugins: command === 'serve' ? [localStateWriterPlugin()] : [],
    server: {
    port: 0,
    strictPort: false,
  },
}));
