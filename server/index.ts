import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { loadConfig, assetsDir, dataDir, distDir } from './config.ts'
import { createMapRouter } from './routes/map.ts'

const config = loadConfig()
const app = express()

// API routes
app.use('/api', createMapRouter(config))

// Serve client assets (appearances.dat, sprites, etc.)
app.use(express.static(assetsDir))
app.use('/sprites-png', express.static(assetsDir))

// Serve data files (materials, items.xml, etc.)
app.use('/data', express.static(dataDir))

// Serve built frontend
app.use(express.static(distDir))

// SPA fallback
app.get('*path', (_req, res) => {
  const indexPath = path.join(distDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('Frontend not built. Run npm run build first.')
  }
})

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`)
  console.log(`  Map dir: ${config.mapDir}`)
})
