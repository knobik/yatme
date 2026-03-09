import { useRef, useEffect } from 'react'
import type { Texture } from 'pixi.js'
import { getTextureSync, preloadSheets } from '../lib/TextureManager'
import type { AppearanceData } from '../lib/appearances'
import { getItemPreviewSpriteId } from '../lib/SpriteResolver'

interface ItemSpriteProps {
  itemId: number
  appearances: AppearanceData
  size?: number
  /** Count/charges — affects sprite pattern for stackable and liquid items */
  count?: number
}

export function ItemSprite({ itemId, appearances, size = 32, count }: ItemSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const appearance = appearances.objects.get(itemId)
    if (!appearance) return

    const spriteId = getItemPreviewSpriteId(appearance, count)
    if (!spriteId) return

    const texture = getTextureSync(spriteId)
    if (texture) {
      drawTexture(canvas, texture, size)
      return
    }

    // Texture not yet loaded — trigger load and re-render
    preloadSheets([spriteId]).then(() => {
      const tex = getTextureSync(spriteId)
      if (tex && canvasRef.current) {
        drawTexture(canvasRef.current, tex, size)
      }
    })
  }, [itemId, appearances, size, count])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    />
  )
}

function drawTexture(canvas: HTMLCanvasElement, texture: Texture, size: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  // Get the source image from the PixiJS texture
  const source = texture.source?.resource
  if (!source) return

  const frame = texture.frame
  const sw = frame.width
  const sh = frame.height

  // Scale to fit, anchored at bottom-right (matching Tibia's item rendering)
  const scale = Math.min(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = size - dw
  const dy = size - dh

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, frame.x, frame.y, sw, sh, dx, dy, dw, dh)
}
