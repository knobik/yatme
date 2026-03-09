// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTownsModal } from './EditTownsModal'
import type { OtbmTown } from '../lib/otbm'
import type { HouseData } from '../lib/sidecars'

function makeTown(overrides: Partial<OtbmTown> = {}): OtbmTown {
  return { id: 1, name: 'Thais', templeX: 100, templeY: 200, templeZ: 7, ...overrides }
}

function makeHouse(overrides: Partial<HouseData> = {}): HouseData {
  return {
    id: 1, name: 'House A', entryX: 0, entryY: 0, entryZ: 7,
    rent: 0, townId: 1, size: 0, clientId: 0, guildhall: false, beds: 0,
    ...overrides,
  }
}

const defaultProps = () => ({
  towns: [makeTown(), makeTown({ id: 2, name: 'Venore', templeX: 300, templeY: 400, templeZ: 7 })],
  houses: [] as HouseData[],
  onApply: vi.fn(),
  onClose: vi.fn(),
  onNavigate: vi.fn(),
})

describe('EditTownsModal', () => {
  it('renders list of existing towns', () => {
    render(<EditTownsModal {...defaultProps()} />)
    expect(screen.getByText('Thais')).toBeTruthy()
    expect(screen.getByText('Venore')).toBeTruthy()
    expect(screen.getByText('#1')).toBeTruthy()
    expect(screen.getByText('#2')).toBeTruthy()
  })

  it('add town assigns correct incremented ID', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    fireEvent.click(screen.getByText('Add'))
    expect(screen.getByText('Unnamed Town')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
  })

  it('delete town blocked when houses reference it', () => {
    const props = defaultProps()
    props.houses = [makeHouse({ townId: 1 })]
    render(<EditTownsModal {...props} />)
    fireEvent.click(screen.getByText('Remove'))
    expect(screen.getByText(/Cannot delete: 1 house/)).toBeTruthy()
  })

  it('delete town succeeds when no houses reference it', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    fireEvent.click(screen.getByText('Remove'))
    expect(screen.queryByText('Thais')).toBeNull()
    expect(screen.queryByText(/Cannot delete/)).toBeNull()
  })

  it('rename town updates working copy', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const nameInput = screen.getByDisplayValue('Thais')
    fireEvent.change(nameInput, { target: { value: 'New Thais' } })
    expect(screen.getByText('New Thais')).toBeTruthy()
  })

  it('temple position fields update correctly', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const xInput = screen.getByDisplayValue('100')
    fireEvent.change(xInput, { target: { value: '555' } })
    expect(screen.getByDisplayValue('555')).toBeTruthy()
  })

  it('apply calls onApply with modified towns', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const nameInput = screen.getByDisplayValue('Thais')
    fireEvent.change(nameInput, { target: { value: 'New Thais' } })
    fireEvent.click(screen.getByText('Apply'))
    expect(props.onApply).toHaveBeenCalledTimes(1)
    const applied = props.onApply.mock.calls[0][0] as OtbmTown[]
    expect(applied[0].name).toBe('New Thais')
    expect(applied[1].name).toBe('Venore')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('cancel does not call onApply', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(props.onApply).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('go to calls onNavigate with temple coordinates', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    fireEvent.click(screen.getByText('Go To Temple'))
    expect(props.onNavigate).toHaveBeenCalledWith(100, 200, 7)
  })

  it('pasting a position string fills temple X/Y/Z', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const xInput = screen.getByDisplayValue('100')
    fireEvent.paste(xInput, { clipboardData: { getData: () => '{x=500, y=600, z=5}' } })
    expect(screen.getByDisplayValue('500')).toBeTruthy()
    expect(screen.getByDisplayValue('600')).toBeTruthy()
    expect(screen.getByDisplayValue('5')).toBeTruthy()
  })

  it('pasting comma-separated position fills temple fields', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const yInput = screen.getByDisplayValue('200')
    fireEvent.paste(yInput, { clipboardData: { getData: () => '800, 900, 3' } })
    expect(screen.getByDisplayValue('800')).toBeTruthy()
    expect(screen.getByDisplayValue('900')).toBeTruthy()
    expect(screen.getByDisplayValue('3')).toBeTruthy()
  })

  it('pasting non-position text does not change fields', () => {
    const props = defaultProps()
    render(<EditTownsModal {...props} />)
    const xInput = screen.getByDisplayValue('100')
    fireEvent.paste(xInput, { clipboardData: { getData: () => 'hello world' } })
    expect(screen.getByDisplayValue('100')).toBeTruthy()
    expect(screen.getByDisplayValue('200')).toBeTruthy()
  })
})
