import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // heic2any (~1.3 MB) is only fetched when a HEIC photo can't be opened natively.
  build: { chunkSizeWarningLimit: 1500 },
})
