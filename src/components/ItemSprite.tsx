import { useRef, useEffect } from 'react'
import { getTextureSync, preloadSheets } from '../lib/TextureManager'
import type { AppearanceData } from '../lib/appearances'
import { getItemPreviewSpriteId } from '../lib/SpriteResolver'
import { drawSpriteToCanvas } from '../lib/canvasUtils'

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
      drawSpriteToCanvas(canvas, texture, size, 'bottom-right')
      return
    }

    // Texture not yet loaded — trigger load and re-render
    preloadSheets([spriteId]).then(() => {
      const tex = getTextureSync(spriteId)
      if (tex && canvasRef.current) {
        drawSpriteToCanvas(canvasRef.current, tex, size, 'bottom-right')
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
