# Tibia Map Editor — Claude Instructions

## UI Design Principles — "Dark Forge"

A precision instrument shell. Dark steel frame, warm amber highlights.
The map viewport is king — UI stays compact and out of the way.

1. **Content-first** — maximize viewport, minimize chrome. No unnecessary panels or decorations.
2. **Information-dense** — pack data tight with clear hierarchy. Use label/value pattern (uppercase condensed labels, monospace values).
3. **Warm on cold** — amber/gold accents (`#d4a549`) on cool dark surfaces. Evokes torchlight on stone — ties to Tibia's fantasy theme.
4. **Crisp precision** — small radii (3-7px), pixel-aligned edges. No bubbly soft rounding. This is a tool, not a toy.
5. **Layered depth** — frosted glass panels (`backdrop-filter: blur`), subtle shadows, elevation through opacity. Panels let the map bleed through.

### Typography
- **UI text**: Barlow (400/500/600/700)
- **Labels**: Barlow Condensed, uppercase, wide tracking, tertiary color
- **Data values**: JetBrains Mono, primary color
- **Accent values**: JetBrains Mono, `--accent-text` color
- Base size: 12px. Keep UI text small and dense.

### Color Palette
- Backgrounds: `--bg-void` (#07070a) through `--bg-active` (#26262f)
- Glass panels: `--glass-bg` (rgba 82% opacity) with 12px blur
- Text: `--text-primary` (#e4e2de), `--text-secondary` (#908d85), `--text-tertiary` (#5c5a54)
- Accent: `--accent` (#d4a549) — warm amber/gold
- Semantic: `--danger` (#c44040), `--success` (#4a9e6a), `--info` (#5b9fd4)

### Component Patterns
- Use `.panel` class for overlay containers (frosted glass)
- Use `.btn` / `.btn-icon` for buttons
- Use `.label` + `.value` for data display
- Use `.separator` / `.separator-v` for visual dividers
- Use `.kbd` for keyboard shortcut hints

### Design system file
All CSS variables and base classes: `src/styles/theme.css`

## UI Conventions

- All tools, views, and map operations must have entries in the **hamburger menu** (`src/components/Toolbar.tsx` → `menuSections`) — not just keyboard shortcuts or context menu items.
