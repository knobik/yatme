# Code Quality TODO

## Critical

### 1. `useEditorTools.ts` is a god hook
- **File**: `src/hooks/useEditorTools.ts` (900+ lines)
- Handles selection, painting, pasting, dragging, erasing, and tool switching all in one hook.
- **Fix**: Split into per-tool hooks (e.g., `useSelectionTool`, `usePaintTool`, `usePasteTool`, `useDragTool`, `useEraserTool`).

### 2. `App.tsx` has a 200+ line `init()` function inside `useEffect`
- **File**: `src/App.tsx`
- Mixes asset loading, renderer setup, and event wiring in a single massive function.
- **Fix**: Decompose into focused initialization functions or a custom hook.

### 3. Duplicated render loop between `TileRenderer.ts` and `SelectionOverlay.ts`
- **Files**: `src/lib/TileRenderer.ts`, `src/components/SelectionOverlay.ts`
- Both walk tile items and render sprites with nearly identical logic.
- **Fix**: Extract shared rendering logic into a common utility.

## Major

### 4. Debug globals exposed in production
- `window.__renderer` and `window.__brushRegistry` are set unconditionally.
- **Fix**: Gate behind `import.meta.env.DEV` or remove entirely.

### 5. `any` types in components
- **Files**: `src/components/ItemSprite.tsx` (datum typed as `any`), `src/components/Inspector.tsx` (several `any` casts)
- **Fix**: Add proper type annotations.

### 6. `MapMutator.ts` neighbor-update duplication
- **File**: `src/lib/MapMutator.ts`
- `paintGround`, `paintWall`, `paintCarpet`, `paintTable` all have near-identical 30-line neighbor-update blocks.
- **Fix**: Consolidate into a shared helper like `updateNeighborTile(nx, ny, z, registry, transformFn)`.

### 7. `inspectorAnchorRef` coupling
- **File**: `src/App.tsx`
- Ref is allocated in `App.tsx` but logically belongs to Inspector's shift-click range selection behavior.
- **Fix**: Move range-selection state into `Inspector.tsx` or manage via callback.

### 8. `ItemSprite.tsx` dead `drawnRef`
- **File**: `src/components/ItemSprite.tsx`
- `drawnRef` is set but never read — was intended as a re-draw guard.
- **Fix**: Either implement the guard (`if (drawnRef.current === spriteId) return`) or remove the ref.

## Minor

### 9. Duplicated Escape key handler
- **Files**: `ContextMenu.tsx`, `HamburgerMenu.tsx`, `GoToPositionDialog.tsx`, `SettingsModal.tsx`
- All implement the same `useEffect` pattern for Escape key dismissal.
- **Fix**: Extract `useEscapeKey(onClose)` hook.

### 10. Duplicated click-outside pattern
- **Files**: `ContextMenu.tsx`, `HamburgerMenu.tsx`
- Both use the same `requestAnimationFrame` + `pointerdown` capture pattern.
- **Fix**: Extract `useClickOutside(ref, onClose)` hook.

### 11. Magic numbers in rendering code
- 32, 64 for tile sizes; 7 for ground floor level scattered throughout.
- **Fix**: Define named constants (e.g., `TILE_SIZE`, `GROUND_FLOOR`).

### 12. Long parameter lists in `MapMutator` paint methods
- **File**: `src/lib/MapMutator.ts`
- **Fix**: Group related parameters into option objects or structs.
