import type { Texture } from 'pixi.js'

export type SpriteAnchor = 'bottom-right' | 'bottom-center'

/** Draw a PixiJS texture to a canvas, scaled to fit with the given anchor. */
export function drawSpriteToCanvas(
  canvas: HTMLCanvasElement,
  texture: Texture,
  size: number,
  anchor: SpriteAnchor = 'bottom-right',
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  const source = texture.source?.resource
  if (!source) return

  const frame = texture.frame
  const sw = frame.width
  const sh = frame.height

  const scale = Math.min(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = anchor === 'bottom-center' ? (size - dw) / 2 : size - dw
  const dy = size - dh

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, frame.x, frame.y, sw, sh, dx, dy, dw, dh)
}
