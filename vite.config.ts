import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function serveDataDir() {
  const dataDir = path.resolve(__dirname, 'data')
  return {
    name: 'serve-data-dir',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/data/')) return next()
        const filePath = path.join(dataDir, req.url.slice(5))
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), serveDataDir()],
  publicDir: path.resolve(__dirname, 'tibia-versions/15.00/sprites'),
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
