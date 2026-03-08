import { Container } from 'pixi.js'
import { FLOOR_ABOVE_ALPHA } from './constants'

// ── FloorManager ────────────────────────────────────────────────────

export class FloorManager {
  private _containers = new Map<number, Container>()
  private _lastVisibleFloors: number[] = []

  private _parent: Container
  private _overlays: Container[]   // ordered overlay containers (zones, houses, selection, lights…)

  constructor(parent: Container, ...overlays: (Container | undefined)[]) {
    this._parent = parent
    this._overlays = overlays.filter((c): c is Container => c != null)
  }

  /** Get (or lazily create) the container for a floor. */
  getContainer(z: number): Container {
    let container = this._containers.get(z)
    if (!container) {
      container = new Container()
      container.sortableChildren = true
      this._containers.set(z, container)
    }
    return container
  }

  /** Update floor containers for the current set of visible floors. */
  update(
    visibleFloors: number[],
    getFloorOffset: (z: number) => number,
    currentFloor: number,
    showTransparentUpper: boolean,
  ): void {
    const floorsChanged = !this._arraysEqual(this._lastVisibleFloors, visibleFloors)

    if (!floorsChanged) {
      for (const z of visibleFloors) {
        const container = this._containers.get(z)!
        const offset = getFloorOffset(z)
        container.position.set(-offset, -offset)
        container.alpha = (z < currentFloor && showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
      }
      return
    }

    const visibleSet = new Set(visibleFloors)

    for (const [z, container] of this._containers) {
      if (!visibleSet.has(z)) {
        this._parent.removeChild(container)
        container.destroy()
        this._containers.delete(z)
      }
    }

    for (const z of visibleFloors) {
      const container = this.getContainer(z)
      const offset = getFloorOffset(z)
      container.position.set(-offset, -offset)
      container.alpha = (z < currentFloor && showTransparentUpper) ? FLOOR_ABOVE_ALPHA : 1.0
    }

    for (const container of this._containers.values()) {
      if (container.parent === this._parent) {
        this._parent.removeChild(container)
      }
    }
    for (const overlay of this._overlays) {
      if (overlay.parent === this._parent) {
        this._parent.removeChild(overlay)
      }
    }
    for (const z of visibleFloors) {
      this._parent.addChild(this._containers.get(z)!)
    }
    for (const overlay of this._overlays) {
      this._parent.addChild(overlay)
    }

    this._lastVisibleFloors = visibleFloors.slice()
  }

  /** Recycle all floor containers (used when switching floors). */
  recycleAll(): void {
    for (const [_z, container] of this._containers) {
      this._parent.removeChild(container)
      container.destroy()
    }
    this._containers.clear()
    this._lastVisibleFloors = []
  }

  /** Force re-evaluation on next update (e.g. when transparent-upper toggles). */
  invalidate(): void {
    this._lastVisibleFloors = []
  }

  destroy(): void {
    this.recycleAll()
  }

  private _arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
