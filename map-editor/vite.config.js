import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from one level up to access the game assets folder
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, '../game/assets')
    }
  }
})
