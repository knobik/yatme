import type { OtbmTile, OtbmItem } from '../lib/otbm'
import type { ItemRegistry } from '../lib/items'
import type { AppearanceData } from '../lib/appearances'
import { getItemDisplayName } from '../lib/items'
import { ItemSprite } from './ItemSprite'

interface InspectorProps {
  tile: OtbmTile | null
  registry: ItemRegistry
  appearances: AppearanceData
  onClose: () => void
  offset?: boolean
}

export function Inspector({ tile, registry, appearances, onClose, offset }: InspectorProps) {
  if (!tile) return null

  return (
    <div className={`panel inspector${offset ? ' inspector-offset' : ''}`}>
      {/* Header */}
      <div className="inspector-header">
        <span className="label" style={{ fontSize: 'var(--text-md)', letterSpacing: 'var(--tracking-wide)' }}>
          INSPECTOR
        </span>
        <button className="btn btn-icon" onClick={onClose} title="Close (Esc)" style={{ border: 'none', background: 'transparent' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="separator" />

      {/* Position */}
      <div className="inspector-section">
        <div className="inspector-field">
          <span className="label">POSITION</span>
          <span className="value">{tile.x}, {tile.y}, {tile.z}</span>
        </div>
        {tile.flags !== 0 && (
          <div className="inspector-field">
            <span className="label">FLAGS</span>
            <span className="value">0x{tile.flags.toString(16).padStart(8, '0')}</span>
          </div>
        )}
        {tile.houseId != null && (
          <div className="inspector-field">
            <span className="label">HOUSE</span>
            <span className="value">{tile.houseId}</span>
          </div>
        )}
      </div>

      <div className="separator" />

      {/* Items */}
      <div className="inspector-items">
        {tile.items.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
            No items
          </div>
        ) : (
          tile.items.map((item, i) => (
            <ItemRow key={i} item={item} registry={registry} appearances={appearances} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  registry,
  appearances,
  depth,
}: {
  item: OtbmItem
  registry: ItemRegistry
  appearances: AppearanceData
  depth: number
}) {
  const name = getItemDisplayName(item.id, registry, appearances)
  const attrs = getItemAttributes(item)

  return (
    <>
      <div className="item-row" style={{ paddingLeft: `calc(var(--space-4) + ${depth * 16}px)` }}>
        <ItemSprite itemId={item.id} appearances={appearances} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="item-name">
            {name}
          </div>
          <div className="item-attr">ID: {item.id}</div>
          {attrs.map((attr, i) => (
            <div key={i} className="item-attr">{attr}</div>
          ))}
        </div>
      </div>
      {/* Container children */}
      {item.items && item.items.length > 0 && (
        item.items.map((child, i) => (
          <ItemRow key={i} item={child} registry={registry} appearances={appearances} depth={depth + 1} />
        ))
      )}
    </>
  )
}

function getItemAttributes(item: OtbmItem): string[] {
  const attrs: string[] = []
  if (item.actionId != null) attrs.push(`AID: ${item.actionId}`)
  if (item.uniqueId != null) attrs.push(`UID: ${item.uniqueId}`)
  if (item.count != null && item.count > 1) attrs.push(`Count: ${item.count}`)
  if (item.text) attrs.push(`Text: "${item.text}"`)
  if (item.description) attrs.push(`Desc: "${item.description}"`)
  if (item.teleportDestination) {
    const d = item.teleportDestination
    attrs.push(`Dest: ${d.x}, ${d.y}, ${d.z}`)
  }
  if (item.depotId != null) attrs.push(`Depot: ${item.depotId}`)
  if (item.houseDoorId != null) attrs.push(`Door: ${item.houseDoorId}`)
  if (item.charges != null) attrs.push(`Charges: ${item.charges}`)
  if (item.duration != null) attrs.push(`Duration: ${item.duration}`)
  return attrs
}
