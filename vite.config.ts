import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Identifiant de build (commit court), affiché dans le profil pour savoir quelle version de la PWA tourne.
const build = (() => {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
})()

// VITE_BASE : sous-chemin d'hébergement (ex. /pokedle/ pour GitHub Pages), '/' par défaut.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Pokédle Battle',
        short_name: 'Pokédle',
        description: 'Un combat Pokémon par jour, le même pour tout le monde.',
        theme_color: '#1a1c2c',
        background_color: '#1a1c2c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'], // gestion des notifications push (public/push-sw.js)
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith('/PokeAPI/sprites/'),
          handler: 'CacheFirst',
          options: { cacheName: 'sprites', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 } }, // images PokéAPI : cache à la demande
        }, {
          urlPattern: ({ url }: { url: URL }) => url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith('/PokeAPI/cries/'),
          handler: 'CacheFirst',
          options: { cacheName: 'cries', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 60 } }, // cris Pokémon : cache à la demande
        }, {
          urlPattern: ({ url }: { url: URL }) => url.hostname === 'play.pokemonshowdown.com' && url.pathname.startsWith('/sprites/gen5ani'),
          handler: 'CacheFirst',
          options: { cacheName: 'sprites-bw-ani', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 } }, // GIF BW/BW2 (Showdown) : réponses opaques (pas de CORS), comptées ~7 Mo chacune dans le quota → peu d'entrées
        }, {
          urlPattern: ({ url }: { url: URL }) => url.hostname === 'play.pokemonshowdown.com' && url.pathname.startsWith('/sprites/trainers/'),
          handler: 'CacheFirst',
          options: { cacheName: 'trainer-sprites', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 } }, // sprites de dresseurs (Showdown)
        }],
      },
    }),
  ],
})
