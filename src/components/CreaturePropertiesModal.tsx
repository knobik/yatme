import { useState } from 'react'
import type { TileCreature } from '../lib/creatures/types'
import { Direction } from '../lib/creatures/types'
import { PropertiesModalShell } from './PropertiesModalShell'

const DIRECTION_OPTIONS: { label: string; value: Direction }[] = [
  { label: 'North', value: Direction.NORTH },
  { label: 'East', value: Direction.EAST },
  { label: 'South', value: Direction.SOUTH },
  { label: 'West', value: Direction.WEST },
]

interface CreaturePropertiesModalProps {
  creature: TileCreature
  onApply: (props: Partial<TileCreature>) => void
  onCancel: () => void
}

export function CreaturePropertiesModal({ creature, onApply, onCancel }: CreaturePropertiesModalProps) {
  const [direction, setDirection] = useState<Direction>(creature.direction)
  const [spawnTime, setSpawnTime] = useState(creature.spawnTime)
  const [weight, setWeight] = useState(creature.weight ?? 100)

  const handleApply = () => {
    const props: Partial<TileCreature> = { direction, spawnTime }
    if (!creature.isNpc) {
      props.weight = Math.max(0, Math.min(255, weight))
    }
    onApply(props)
  }

  return (
    <PropertiesModalShell
      title="CREATURE PROPERTIES"
      subtitle={`${creature.name} (${creature.isNpc ? 'NPC' : 'Monster'})`}
      onApply={handleApply}
      onCancel={onCancel}
      minWidth="min-w-[400px]"
      maxWidth="max-w-[480px]"
    >
      <div className="item-properties">
        <div className="item-prop-row">
          <div className="item-prop-field">
            <span className="label text-sm">DIRECTION</span>
            <select
              className="item-prop-input has-value"
              value={direction}
              onChange={e => setDirection(Number(e.target.value) as Direction)}
            >
              {DIRECTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="item-prop-row">
          <div className="item-prop-field">
            <span className="label text-sm">SPAWN TIME (S)</span>
            <input
              className="item-prop-input has-value"
              type="number"
              min={0}
              value={spawnTime}
              onChange={e => setSpawnTime(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
        </div>

        {!creature.isNpc && (
          <div className="item-prop-row">
            <div className="item-prop-field">
              <span className="label text-sm">WEIGHT</span>
              <input
                className="item-prop-input has-value"
                type="number"
                min={0}
                max={255}
                value={weight}
                onChange={e => setWeight(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
        )}
      </div>
    </PropertiesModalShell>
  )
}
