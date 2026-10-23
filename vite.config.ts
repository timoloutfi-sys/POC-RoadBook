/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Version affichée dans Réglages : pour vérifier que le téléphone a bien la dernière mise en ligne.
const sha = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString().trim() } catch { return 'dev' } })()).slice(0, 7)
const BUILD = JSON.stringify(`${sha} · ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)

// Publié sur GitHub Pages sous /POC-RoadBook/
const base = process.env.BASE_PATH ?? '/POC-RoadBook/'

export default defineConfig({
  base,
  define: { __BUILD__: BUILD },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Road book',
        short_name: 'Road book',
        description: 'Second écran de stratégie vélo : le GPS dit où aller, cet écran dit comment courir.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0F13',
        theme_color: '#0B0F13',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
