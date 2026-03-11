import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy REST API — Binance US handles US-region traffic
      '/binance-api': {
        target: 'https://api.binance.us',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/binance-api/, ''),
        secure: true,
      },
      // Proxy WebSocket stream — Binance US WS
      '/binance-ws': {
        target: 'wss://stream.binance.us:9443',
        changeOrigin: true,
        ws: true,
        rewrite: path => path.replace(/^\/binance-ws/, ''),
        secure: true,
      },
    },
  },
})
