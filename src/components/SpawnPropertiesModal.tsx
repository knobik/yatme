import { useState } from 'react'
import { PropertiesModalShell } from './PropertiesModalShell'

interface SpawnPropertiesModalProps {
  spawnType: 'monster' | 'npc'
  currentRadius: number
  onApply: (newRadius: number) => void
  onCancel: () => void
}

export function SpawnPropertiesModal({ spawnType, currentRadius, onApply, onCancel }: SpawnPropertiesModalProps) {
  const [radius, setRadius] = useState(currentRadius)

  const handleApply = () => {
    onApply(Math.max(1, Math.min(15, radius)))
  }

  return (
    <PropertiesModalShell
      title="SPAWN ZONE PROPERTIES"
      subtitle={spawnType === 'monster' ? 'Monster Spawn' : 'NPC Spawn'}
      onApply={handleApply}
      onCancel={onCancel}
    >
      <div className="item-properties">
        <div className="item-prop-row">
          <div className="item-prop-field">
            <span className="label text-sm">RADIUS</span>
            <input
              className="item-prop-input has-value"
              type="number"
              min={1}
              max={15}
              value={radius}
              onChange={e => setRadius(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>
      </div>
    </PropertiesModalShell>
  )
}
