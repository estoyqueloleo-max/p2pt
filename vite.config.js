import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno según el modo (ej: .env, .env.estoyqueloleo)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [
      nodePolyfills({
        globals: {
          Buffer: true, // required by isomorphic-git
          global: true,
          process: true,
        },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
          name: env.VITE_APP_TITLE || 'Pingo - Real-time Location',
          short_name: env.VITE_APP_SHORT_NAME || 'Pingo',
          description: env.VITE_APP_DESC || 'Share your location in real-time using P2P technology.',
          start_url: '.',
          display: 'standalone',
          background_color: env.VITE_APP_BG_COLOR || '#020617',
          theme_color: env.VITE_APP_THEME_COLOR || '#6366f1',
          icons: [
            {
              src: env.VITE_APP_ICON || 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: env.VITE_APP_ICON_512 || 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ],
          shortcuts: [
            {
              name: 'Mi Ubicación',
              short_name: 'Mi Ubicación',
              description: 'Ver mi ubicación actual',
              url: '/',
              icons: [{ src: env.VITE_APP_ICON || 'icon-192x192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Agenda',
              short_name: 'Agenda',
              description: 'Ver mis contactos',
              url: '/?tab=agenda',
              icons: [{ src: env.VITE_APP_ICON || 'icon-192x192.png', sizes: '192x192', type: 'image/png' }]
            }
          ],
          share_target: {
            action: "_share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              files: [
                {
                  name: "file",
                  accept: [".json", "application/json", ".txt", "text/plain"]
                }
              ]
            }
          }
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
        },
        workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cloudflare-assets-cache'
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true, // Exponer a la red local (0.0.0.0)
    https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    },
    watch: {
      ignored: ['**/backend/**', '**/tests/**', '**/test-results/**', '**/playwright-report/**', '**/.git/**']
    }
  },
  optimizeDeps: {
    entries: ['index.html'] // Forzar a Vite a mirar solo el punto de entrada real
  },
  build: {
    emptyOutDir: true, // Limpiar dist/ antes de compilar
    sourcemap: true
  }
  };
});
