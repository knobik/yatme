/** MIME types used for drag-and-drop of items between UI components and the map canvas. */
export const MIME_TIBIA_ITEM = 'application/x-tibia-item'
export const MIME_TIBIA_INSPECTOR = 'application/x-tibia-inspector'

/**
 * Use a source `<canvas>` element as the drag image for a drag event.
 * Clones the canvas content into a temporary element, positions it offscreen,
 * and schedules removal after the browser captures the drag image.
 */
export function setCanvasDragImage(
  dataTransfer: DataTransfer,
  sourceCanvas: HTMLCanvasElement,
  offsetX?: number,
  offsetY?: number,
): void {
  const ghost = document.createElement('canvas')
  ghost.width = sourceCanvas.width
  ghost.height = sourceCanvas.height
  const ctx = ghost.getContext('2d')
  if (ctx) ctx.drawImage(sourceCanvas, 0, 0)
  ghost.style.position = 'fixed'
  ghost.style.left = '-9999px'
  document.body.appendChild(ghost)
  dataTransfer.setDragImage(ghost, offsetX ?? ghost.width / 2, offsetY ?? ghost.height / 2)
  requestAnimationFrame(() => document.body.removeChild(ghost))
}
