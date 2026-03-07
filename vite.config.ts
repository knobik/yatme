import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function serveStaticDir(urlPrefix: string, dirPath: string) {
  const dir = path.resolve(__dirname, dirPath)
  return {
    name: `serve-${urlPrefix.replace(/\//g, '-')}`,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(urlPrefix)) return next()
        const filePath = path.join(dir, req.url.slice(urlPrefix.length))
        if (!path.resolve(filePath).startsWith(dir)) return next()
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const stat = fs.statSync(filePath)
          res.setHeader('Content-Length', stat.size)
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
  plugins: [
    tailwindcss(),
    react(),
    serveStaticDir('/sprites-png/', 'tibia-versions/15.00/sprites-png'),
    serveStaticDir('/data/', 'data'),
    serveStaticDir('/maps/', 'maps'),
  ],
  publicDir: false,
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
