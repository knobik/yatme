import { useRef, useEffect } from 'react'
import type { Texture } from 'pixi.js'
import { getTextureSync, preloadSheets } from '../lib/TextureManager'
import type { AppearanceData } from '../lib/appearances'
import { getItemPreviewSpriteId } from '../lib/SpriteResolver'

type Anchor = 'bottom-right' | 'bottom-center'

interface ItemSpriteByIdProps {
  itemId: number
  appearances: AppearanceData
  spriteId?: never
  size?: number
  /** Count/charges — affects sprite pattern for stackable and liquid items */
  count?: number
  /** Anchor point for sprites smaller than the canvas. Default: 'bottom-right' */
  anchor?: Anchor
}

interface ItemSpriteByRawIdProps {
  spriteId: number | null
  itemId?: never
  appearances?: never
  size?: number
  count?: never
  anchor?: Anchor
}

type ItemSpriteProps = ItemSpriteByIdProps | ItemSpriteByRawIdProps

export function ItemSprite(props: ItemSpriteProps) {
  const { size = 32, anchor = 'bottom-right' } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Resolve the sprite ID from either direct prop or item lookup
  const resolvedSpriteId = 'spriteId' in props && props.spriteId !== undefined
    ? props.spriteId
    : (() => {
        if (!props.appearances) return null
        const appearance = props.appearances.objects.get(props.itemId!)
        if (!appearance) return null
        return getItemPreviewSpriteId(appearance, props.count) ?? null
      })()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (resolvedSpriteId == null) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, size, size)
      return
    }

    const texture = getTextureSync(resolvedSpriteId)
    if (texture) {
      drawTexture(canvas, texture, size, anchor)
      return
    }

    // Texture not yet loaded — trigger load and draw when ready
    let cancelled = false
    preloadSheets([resolvedSpriteId]).then(() => {
      if (cancelled) return
      const tex = getTextureSync(resolvedSpriteId)
      if (tex && canvasRef.current) {
        drawTexture(canvasRef.current, tex, size, anchor)
      }
    })
    return () => { cancelled = true }
  }, [resolvedSpriteId, size, anchor])

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

function drawTexture(canvas: HTMLCanvasElement, texture: Texture, size: number, anchor: Anchor): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  // Get the source image from the PixiJS texture
  const source = texture.source?.resource
  if (!source) return

  const frame = texture.frame
  const sw = frame.width
  const sh = frame.height

  // Scale to fit, anchored at the specified position
  const scale = Math.min(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = anchor === 'bottom-center' ? (size - dw) / 2 : size - dw
  const dy = size - dh

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, frame.x, frame.y, sw, sh, dx, dy, dw, dh)
}
