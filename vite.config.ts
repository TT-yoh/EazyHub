import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      // ⭐ THE PWA EXTENSION: Configures asset caching behaviors for offline-ready standalone mode
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'], 
      
      workbox: {
        // Caches all compiled JS, CSS, and public folder assets automatically
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      
      manifest: {
        name: 'EazyHub Connect',
        short_name: 'EazyHub',
        description: 'On-demand logistics distribution and marketplace terminal',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      }
    })
  ],
  server: {
    allowedHosts: process.env.VITE_DEV_TUNNEL_HOST ? [process.env.VITE_DEV_TUNNEL_HOST] : true,
  },
})