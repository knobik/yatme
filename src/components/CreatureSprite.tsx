import { useRef, useEffect } from 'react'
import { getTextureSync, preloadSheets } from '../lib/TextureManager'
import type { AppearanceData } from '../lib/appearances'
import type { CreatureOutfit } from '../lib/creatures'
import { getSpriteIndex, getItemPreviewSpriteId } from '../lib/SpriteResolver'
import { drawSpriteToCanvas } from '../lib/canvasUtils'

interface CreatureSpriteProps {
  outfit: CreatureOutfit
  appearances: AppearanceData
  size?: number
}

/**
 * Renders a creature outfit preview to a canvas element.
 * - If `outfit.looktype > 0`: renders the outfit's south-facing idle frame
 * - If `outfit.lookitem > 0`: renders the item sprite (same as ItemSprite)
 * - Otherwise: renders a colored placeholder
 *
 * No outfit color tinting in this version — base sprite only.
 */
export function CreatureSprite({ outfit, appearances, size = 32 }: CreatureSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const spriteId = resolveCreatureSpriteId(outfit, appearances)
    if (!spriteId) {
      drawPlaceholder(canvas, size)
      return
    }

    const texture = getTextureSync(spriteId)
    if (texture) {
      drawSpriteToCanvas(canvas, texture, size, 'bottom-center')
      return
    }

    // Texture not yet loaded — show placeholder then async load
    drawPlaceholder(canvas, size)
    preloadSheets([spriteId]).then(() => {
      const tex = getTextureSync(spriteId)
      if (tex && canvasRef.current) {
        drawSpriteToCanvas(canvasRef.current, tex, size, 'bottom-center')
      }
    })
  }, [outfit, appearances, size])

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

/** Resolve the sprite ID for a creature outfit preview. */
function resolveCreatureSpriteId(outfit: CreatureOutfit, appearances: AppearanceData): number | null {
  if (outfit.looktype > 0) {
    const appearance = appearances.outfits.get(outfit.looktype)
    if (!appearance) return null

    const info = appearance.frameGroup?.[0]?.spriteInfo
    if (!info || info.spriteId.length === 0) return null

    // Outfits use patternWidth for directions: typically N=0, E=1, S=2, W=3
    // We want south-facing (index 2) for preview if available
    const pw = Math.max(1, info.patternWidth)
    const southPattern = pw >= 3 ? 2 : 0

    return getSpriteIndex(info, southPattern, 0)
  }

  if (outfit.lookitem > 0) {
    const appearance = appearances.objects.get(outfit.lookitem)
    if (!appearance) return null
    return getItemPreviewSpriteId(appearance)
  }

  return null
}

function drawPlaceholder(canvas: HTMLCanvasElement, size: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)
  const inset = Math.floor(size * 0.2)
  ctx.fillStyle = '#5c5a54'
  ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2)
}
