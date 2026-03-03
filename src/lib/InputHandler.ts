import type { Camera } from './Camera'
import type { OtbmMap, OtbmTile } from './otbm'

type TilePos = { x: number; y: number; z: number }

/**
 * Host interface for the input handler.
 * MapRenderer implements this by having these callback properties.
 */
export interface InputHost {
  readonly camera: Camera
  readonly mapData: OtbmMap

  // Mutable tool callbacks (set by external code like useEditorTools)
  onTilePointerDown?: (pos: TilePos, event: PointerEvent) => void
  onTilePointerMove?: (pos: TilePos, event: PointerEvent) => void
  onTilePointerUp?: (pos: TilePos, event: PointerEvent) => void
  onTileClick?: (tile: OtbmTile | null, worldX: number, worldY: number) => void
}

/**
 * Sets up pointer and wheel event listeners for map panning, zooming, and tool dispatch.
 * Returns a cleanup function to remove all listeners.
 */
export function setupMapInput(
  canvas: HTMLCanvasElement,
  host: InputHost,
  onCameraChange: () => void,
  onSelectTile: (x: number, y: number, z: number, tile: OtbmTile | null) => void,
): () => void {
  const camera = host.camera

  // Drag state (local to this closure)
  let dragging = false
  let dragStartX = 0
  let dragStartY = 0
  let cameraStartX = 0
  let cameraStartY = 0
  let dragDist = 0
  let activeButton = -1
  let toolFired = false

  function onPointerDown(e: PointerEvent) {
    if (e.button === 1) {
      // Middle mouse: always pan
      dragging = true
      dragDist = 0
      dragStartX = e.clientX
      dragStartY = e.clientY
      cameraStartX = camera.x
      cameraStartY = camera.y
      activeButton = 1
      canvas.setPointerCapture(e.pointerId)
    } else if (e.button === 0) {
      // Left mouse: tool callbacks or pan fallback
      dragging = true
      dragDist = 0
      dragStartX = e.clientX
      dragStartY = e.clientY
      cameraStartX = camera.x
      cameraStartY = camera.y
      activeButton = 0
      toolFired = false
      canvas.setPointerCapture(e.pointerId)

      if (host.onTilePointerDown) {
        const rect = canvas.getBoundingClientRect()
        const pos = camera.getTileAt(e.clientX - rect.left, e.clientY - rect.top)
        host.onTilePointerDown(pos, e)
        toolFired = true
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    dragDist = Math.sqrt(dx * dx + dy * dy)

    if (activeButton === 1) {
      // Middle mouse: always pan
      camera.x = cameraStartX - dx / camera.zoom
      camera.y = cameraStartY - dy / camera.zoom
      onCameraChange()
    } else if (activeButton === 0) {
      if (toolFired && host.onTilePointerMove) {
        const rect = canvas.getBoundingClientRect()
        const pos = camera.getTileAt(e.clientX - rect.left, e.clientY - rect.top)
        host.onTilePointerMove(pos, e)
      } else if (!toolFired) {
        // Left mouse without tool: pan
        camera.x = cameraStartX - dx / camera.zoom
        camera.y = cameraStartY - dy / camera.zoom
        onCameraChange()
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return
    const wasClick = dragDist < 4
    dragging = false
    canvas.releasePointerCapture(e.pointerId)

    if (activeButton === 0) {
      if (toolFired && host.onTilePointerUp) {
        const rect = canvas.getBoundingClientRect()
        const pos = camera.getTileAt(e.clientX - rect.left, e.clientY - rect.top)
        host.onTilePointerUp(pos, e)
      } else if (wasClick && !toolFired) {
        // Fallback click behavior (select tool default)
        const rect = canvas.getBoundingClientRect()
        const pos = camera.getTileAt(e.clientX - rect.left, e.clientY - rect.top)
        const key = `${pos.x},${pos.y},${pos.z}`
        const tile = host.mapData.tiles.get(key) ?? null
        onSelectTile(pos.x, pos.y, pos.z, tile)
      }
    }

    activeButton = -1
    toolFired = false
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    camera.zoomAt(mouseX, mouseY, e.deltaY)
    onCameraChange()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
  }
}
