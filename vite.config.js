import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    https: true, // Enable HTTPS for local development (WebRTC requirement)
    host: true, // Allow external access
  }
})
