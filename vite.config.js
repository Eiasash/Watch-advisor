import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true,       // Expose on LAN so phone can access via http://<PC_IP>:5173
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
