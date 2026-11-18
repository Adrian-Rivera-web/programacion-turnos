import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin para soportar la ruta Serverless /api/send-email también en desarrollo local (npm run dev)
function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/send-email', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
            const { default: handler } = await import('./api/send-email.js');

            const customRes = {
              statusCode: 200,
              status(code) {
                this.statusCode = code;
                return this;
              },
              json(payload) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              },
            };

            await handler(req, customRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: err.message || 'Error interno en el servidor local',
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
});
