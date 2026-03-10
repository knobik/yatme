import { useCallback, useRef, useState } from 'react'
import type { OtbmMap } from '../lib/otbm'
import { serializeOtbm } from '../lib/otbm'
import {
  serializeSidecars,
  parseZonesXml,
  serializeZonesXml,
  parseHousesXml,
  serializeHousesXml,
  type MapSidecars,
} from '../lib/sidecars'
import type { MapStorageProvider } from '../lib/storage'
import { updateAllHouseSizes } from '../lib/houseCleanup'
import { triggerDownload } from '../lib/triggerDownload'
import type { SavePhase } from '../components/SaveToast'
import type { SpawnManager } from '../lib/creatures/SpawnManager'
import { collectMonsterSpawns, collectNpcSpawns } from '../lib/creatures/spawnXmlWriter'

/** Open a file picker, read the selected XML file, and pass parsed results to the updater. */
function importXmlFile<T>(
  parser: (xml: string) => T[],
  updater: (items: T[]) => void,
  label: string,
) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xml'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        updater(parser(reader.result as string))
      } catch (e) {
        console.error(`[${label}] Failed to parse imported data:`, e)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

interface UseSaveExportOptions {
  mapData: OtbmMap | null
  mapFilename: string
  sidecarsData: MapSidecars
  setSidecarsData: React.Dispatch<React.SetStateAction<MapSidecars>>
  storageRef: React.RefObject<MapStorageProvider | null>
  spawnManager: SpawnManager | null
}

export function useSaveExport({
  mapData,
  mapFilename,
  sidecarsData,
  setSidecarsData,
  storageRef,
  spawnManager,
}: UseSaveExportOptions) {
  const [saveProgress, setSaveProgress] = useState<number | null>(null)
  const [savePhase, setSavePhase] = useState<SavePhase>('serialize')
  const lastReportedProgress = useRef(0)
  const saveInProgressRef = useRef(false)

  const handleSave = useCallback(async () => {
    const md = mapData
    const provider = storageRef.current
    if (!md || !provider || !provider.canSave || saveInProgressRef.current) return
    saveInProgressRef.current = true
    setSaveProgress(0)
    lastReportedProgress.current = 0
    try {
      // Ensure house sizes are up-to-date and houseFile is set
      updateAllHouseSizes(md.tiles, sidecarsData.houses)
      const sidecarName = (suffix: string) => mapFilename.replace(/\.otbm$/, `-${suffix}.xml`)
      if (sidecarsData.houses.length > 0 && !md.houseFile) {
        md.houseFile = sidecarName('house')
      }

      // Rebuild spawn data from current tile state
      if (spawnManager) {
        const monsterResult = collectMonsterSpawns(md, spawnManager)
        const npcResult = collectNpcSpawns(md, spawnManager)
        sidecarsData.monsterSpawns = monsterResult.spawns
        sidecarsData.npcSpawns = npcResult.spawns
        for (const o of monsterResult.orphans) console.warn(`[Save] Orphan creature skipped: ${o}`)
        for (const o of npcResult.orphans) console.warn(`[Save] Orphan creature skipped: ${o}`)
      }

      // Auto-generate sidecar filenames if creatures exist but filenames aren't set
      if (sidecarsData.monsterSpawns.length > 0 && !md.spawnFile) {
        md.spawnFile = sidecarName('monster')
      }
      if (sidecarsData.npcSpawns.length > 0 && !md.npcFile) {
        md.npcFile = sidecarName('npc')
      }

      setSavePhase('serialize')
      const otbm = await serializeOtbm(md, (done, total) => {
        const pct = total > 0 ? done / total : 0
        if (pct - lastReportedProgress.current >= 0.02) {
          lastReportedProgress.current = pct
          setSaveProgress(pct)
        }
      })
      const sidecars = serializeSidecars(sidecarsData, md)
      const hasUploadPhase = 'uploadWithProgress' in provider
      if (hasUploadPhase) {
        setSavePhase('upload')
        setSaveProgress(0)
        lastReportedProgress.current = 0
      }
      await provider.saveMap({ otbm, sidecars, filename: mapFilename }, (fraction) => {
        if (fraction - lastReportedProgress.current >= 0.02) {
          lastReportedProgress.current = fraction
          setSaveProgress(fraction)
        }
      })
    } catch (e) {
      console.error('[Save] Failed to save map:', e)
      alert(`Failed to save map: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      saveInProgressRef.current = false
      setSaveProgress(null)
    }
  }, [mapData, mapFilename, sidecarsData, storageRef, spawnManager])

  const handleExportZones = useCallback(() => {
    triggerDownload(serializeZonesXml(sidecarsData.zones), 'zones.xml', 'application/xml')
  }, [sidecarsData.zones])

  const handleImportZones = useCallback(() => {
    importXmlFile(parseZonesXml, (imported) => {
      setSidecarsData(prev => {
        const existingIds = new Set(prev.zones.map(z => z.id))
        const newZones = imported.filter(z => !existingIds.has(z.id))
        if (newZones.length === 0) return prev
        return { ...prev, zones: [...prev.zones, ...newZones] }
      })
    }, 'Zones')
  }, [setSidecarsData])

  const handleExportHouses = useCallback(() => {
    triggerDownload(serializeHousesXml(sidecarsData.houses), 'houses.xml', 'application/xml')
  }, [sidecarsData.houses])

  const handleImportHouses = useCallback(() => {
    importXmlFile(parseHousesXml, (imported) => {
      setSidecarsData(prev => {
        const existingIds = new Set(prev.houses.map(h => h.id))
        const newHouses = imported.filter(h => !existingIds.has(h.id))
        if (newHouses.length === 0) return prev
        return { ...prev, houses: [...prev.houses, ...newHouses] }
      })
    }, 'Houses')
  }, [setSidecarsData])

  return {
    saveProgress,
    savePhase,
    handleSave,
    handleExportZones,
    handleImportZones,
    handleExportHouses,
    handleImportHouses,
  }
}
