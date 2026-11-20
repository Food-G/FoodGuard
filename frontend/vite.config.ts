import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 홈 화면 설치(PWA). 화면 파일만 미리 받아 두고 API 응답은 캐시하지 않는다 (재고·발주는 항상 서버 값)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FoodGuard',
        short_name: 'FoodGuard',
        description: '프랜차이즈 가맹점 식자재 낭비를 줄이는 AI 발주 플랫폼',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1F4D3A',
        background_color: '#F2F4F3',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globIgnores: ['homepage*.png'],
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/x-data-grid'],
          echarts: ['echarts'],
        },
      },
    },
  },
  resolve: {
    alias: {
      'src': path.resolve(__dirname, './src'),
      'components': path.resolve(__dirname, './src/components'),
      'layouts': path.resolve(__dirname, './src/layouts'),
      'theme': path.resolve(__dirname, './src/theme'),
      'providers': path.resolve(__dirname, './src/providers'),
    },
  },
});
