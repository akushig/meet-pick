import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/meet-pick/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'MeetPick - 모임 장소 추천',
        short_name: 'MeetPick',
        description: '친구들과 모임 장소를 추천해주는 앱',
        theme_color: '#6366f1',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/meet-pick/',
        scope: '/meet-pick/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
