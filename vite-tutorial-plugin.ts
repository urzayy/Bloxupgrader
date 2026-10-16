import type { Plugin } from 'vite';
import { clientIp, sendJson } from './server/lib/httpAuth.mjs';
import { createTutorialIpStore } from './server/lib/tutorialIpStore.mjs';

export function tutorialPlugin(stateDir: string): Plugin {
  const store = createTutorialIpStore(stateDir);

  return {
    name: 'tutorial-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/tutorial')) return next();

        try {
          const ip = clientIp(req);

          if (req.method === 'GET' && url === '/api/tutorial/status') {
            sendJson(res, 200, { seen: store.hasSeen(ip), ipHint: ip === '127.0.0.1' ? 'local' : 'remote' });
            return;
          }

          if (req.method === 'POST' && url === '/api/tutorial/complete') {
            store.markSeen(ip);
            sendJson(res, 200, { ok: true, seen: true });
            return;
          }

          sendJson(res, 404, { error: 'not found' });
        } catch {
          sendJson(res, 500, { error: 'server error' });
        }
      });
    },
  };
}
