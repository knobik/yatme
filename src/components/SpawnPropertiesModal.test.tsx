// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpawnPropertiesModal } from './SpawnPropertiesModal'

describe('SpawnPropertiesModal', () => {
  it('renders monster spawn type label', () => {
    render(<SpawnPropertiesModal spawnType="monster" currentRadius={5} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Monster Spawn')).toBeTruthy()
  })

  it('renders NPC spawn type label', () => {
    render(<SpawnPropertiesModal spawnType="npc" currentRadius={3} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('NPC Spawn')).toBeTruthy()
  })

  it('initializes radius from currentRadius prop', () => {
    render(<SpawnPropertiesModal spawnType="monster" currentRadius={7} onApply={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByDisplayValue('7') as HTMLInputElement
    expect(input.value).toBe('7')
  })

  it('calls onApply with new radius', () => {
    const onApply = vi.fn()
    render(<SpawnPropertiesModal spawnType="monster" currentRadius={5} onApply={onApply} onCancel={vi.fn()} />)

    const input = screen.getByDisplayValue('5') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10' } })

    fireEvent.click(screen.getByText('Apply'))
    expect(onApply).toHaveBeenCalledWith(10)
  })

  it('clamps radius to 1-15 on apply', () => {
    const onApply = vi.fn()
    render(<SpawnPropertiesModal spawnType="npc" currentRadius={5} onApply={onApply} onCancel={vi.fn()} />)

    const input = screen.getByDisplayValue('5') as HTMLInputElement
    fireEvent.change(input, { target: { value: '20' } })

    fireEvent.click(screen.getByText('Apply'))
    expect(onApply).toHaveBeenCalledWith(15)
  })

  it('clamps radius minimum to 1 on apply', () => {
    const onApply = vi.fn()
    render(<SpawnPropertiesModal spawnType="monster" currentRadius={5} onApply={onApply} onCancel={vi.fn()} />)

    const input = screen.getByDisplayValue('5') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0' } })

    fireEvent.click(screen.getByText('Apply'))
    expect(onApply).toHaveBeenCalledWith(1)
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<SpawnPropertiesModal spawnType="monster" currentRadius={5} onApply={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when scrim is clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(<SpawnPropertiesModal spawnType="monster" currentRadius={5} onApply={vi.fn()} onCancel={onCancel} />)
    const scrim = container.querySelector('.bg-scrim')!
    fireEvent.click(scrim)
    expect(onCancel).toHaveBeenCalled()
  })
})
