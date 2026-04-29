import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';

export default defineConfig({
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
      includeAssets: [],
      manifest: {
        name: 'P2PT - Real-time Location',
        short_name: 'P2PT',
        description: 'Share your location in real-time using P2P technology.',
        start_url: '.',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#6366f1',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/1865/1865269.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Mi Ubicación',
            short_name: 'Mi Ubicación',
            description: 'Ver mi ubicación actual',
            url: '/',
            icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/1865/1865269.png', sizes: '192x192' }]
          },
          {
            name: 'Agenda',
            short_name: 'Agenda',
            description: 'Ver mis contactos',
            url: '/?tab=agenda',
            icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/1865/1865269.png', sizes: '192x192' }]
          }
        ]
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
      ignored: ['**/backend/**'] // Ignorar el backend para evitar errores de escaneo
    }
  },
  optimizeDeps: {
    entries: ['index.html'] // Forzar a Vite a mirar solo el punto de entrada real
  },
  build: {
    emptyOutDir: true, // Limpiar dist/ antes de compilar
    sourcemap: true
  }
});
