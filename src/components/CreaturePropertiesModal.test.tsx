// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreaturePropertiesModal } from './CreaturePropertiesModal'
import type { TileCreature } from '../lib/creatures/types'
import { Direction } from '../lib/creatures/types'

const makeMonster = (overrides?: Partial<TileCreature>): TileCreature => ({
  name: 'Rat',
  direction: Direction.SOUTH,
  spawnTime: 60,
  weight: 100,
  isNpc: false,
  ...overrides,
})

const makeNpc = (overrides?: Partial<TileCreature>): TileCreature => ({
  name: 'Josef',
  direction: Direction.NORTH,
  spawnTime: 3600,
  isNpc: true,
  ...overrides,
})

describe('CreaturePropertiesModal', () => {
  it('renders creature name and type for monster', () => {
    render(<CreaturePropertiesModal creature={makeMonster()} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Rat (Monster)')).toBeTruthy()
  })

  it('renders creature name and type for NPC', () => {
    render(<CreaturePropertiesModal creature={makeNpc()} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Josef (NPC)')).toBeTruthy()
  })

  it('shows weight field for monsters', () => {
    render(<CreaturePropertiesModal creature={makeMonster()} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('WEIGHT')).toBeTruthy()
  })

  it('hides weight field for NPCs', () => {
    render(<CreaturePropertiesModal creature={makeNpc()} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('WEIGHT')).toBeNull()
  })

  it('initializes fields from creature data', () => {
    render(<CreaturePropertiesModal creature={makeMonster({ direction: Direction.EAST, spawnTime: 120, weight: 50 })} onApply={vi.fn()} onCancel={vi.fn()} />)

    const directionSelect = screen.getByDisplayValue('East') as HTMLSelectElement
    expect(directionSelect.value).toBe(String(Direction.EAST))

    const spawnTimeInput = screen.getByDisplayValue('120') as HTMLInputElement
    expect(spawnTimeInput.value).toBe('120')

    const weightInput = screen.getByDisplayValue('50') as HTMLInputElement
    expect(weightInput.value).toBe('50')
  })

  it('calls onApply with changed props for monster', () => {
    const onApply = vi.fn()
    render(<CreaturePropertiesModal creature={makeMonster()} onApply={onApply} onCancel={vi.fn()} />)

    // Change direction
    const directionSelect = screen.getByDisplayValue('South') as HTMLSelectElement
    fireEvent.change(directionSelect, { target: { value: String(Direction.WEST) } })

    // Change spawn time
    const spawnTimeInput = screen.getByDisplayValue('60') as HTMLInputElement
    fireEvent.change(spawnTimeInput, { target: { value: '90' } })

    // Change weight
    const weightInput = screen.getByDisplayValue('100') as HTMLInputElement
    fireEvent.change(weightInput, { target: { value: '200' } })

    fireEvent.click(screen.getByText('Apply'))

    expect(onApply).toHaveBeenCalledWith({
      direction: Direction.WEST,
      spawnTime: 90,
      weight: 200,
    })
  })

  it('calls onApply without weight for NPC', () => {
    const onApply = vi.fn()
    render(<CreaturePropertiesModal creature={makeNpc()} onApply={onApply} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('Apply'))

    const props = onApply.mock.calls[0][0]
    expect(props.direction).toBe(Direction.NORTH)
    expect(props.spawnTime).toBe(3600)
    expect(props.weight).toBeUndefined()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<CreaturePropertiesModal creature={makeMonster()} onApply={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when scrim is clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(<CreaturePropertiesModal creature={makeMonster()} onApply={vi.fn()} onCancel={onCancel} />)
    const scrim = container.querySelector('.bg-scrim')!
    fireEvent.click(scrim)
    expect(onCancel).toHaveBeenCalled()
  })

  it('clamps weight to 0-255 on apply', () => {
    const onApply = vi.fn()
    render(<CreaturePropertiesModal creature={makeMonster({ weight: 100 })} onApply={onApply} onCancel={vi.fn()} />)

    const weightInput = screen.getByDisplayValue('100') as HTMLInputElement
    fireEvent.change(weightInput, { target: { value: '999' } })

    fireEvent.click(screen.getByText('Apply'))
    expect(onApply.mock.calls[0][0].weight).toBe(255)
  })
})
