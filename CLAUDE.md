# REMLUX

## Project

REMLUX is a single-file web app for calculating and visualizing how light spreads in a room, with luminaires organized in groups, in the spirit of DIALux. It is meant for early lighting layout; final results get confirmed in DIALux with the real IES/LDT files.

- `REMLUX_HTML.html`: the whole app (HTML + CSS + one inline `<script>`, ~1000 lines, no build step, no JS dependencies; only Google Fonts: Doto, JetBrains Mono). Open it in a browser to run.
- `REMLUX_MD.md`: the app's UI text and method notes as plain Markdown (a copy of the page's copy, not code).

### App structure
Four pages (`PAGES = ['room','fixture','visualize','stats']`, switched by `showPage`):
- **Room**: shape (rectangle, presets, or custom polygon from corner coordinates), length/width/height, work plane height, wall zone excluded (EN 12464-1: 0.5 m), saved rooms.
- **Fixture**: per group: light distribution (loaded IES file or generic cosⁿ fitted to beam angle), lumens, optional watts, downlight radius; grid formation, placement rectangle, columns/rows or spacing; "Suggest a grid for a target" lux.
- **Visualize**: floor plan heatmap (`#cv` canvas + `#ov` SVG overlay; lights draggable → switches layout to Custom), section along the length, wall scallops (`#wcv` / `#wov`).
- **Stats**: work plane table (Ē, Emin, Emax, U₀ = Emin/Ē, Ud = Emin/Emax), lux distribution, each downlight, spec summary, method.

### Key functions (in `REMLUX_HTML.html`)
- `calc()`: main calculation + render pass.
- `parseIES` / `iesI`: IES file parsing (C-planes averaged into one rotationally symmetric curve) and intensity interpolation. `model(q)`: builds the intensity model.
- Groups: `groups`, `act`, `renderGroups`, `snapGroup`, `saveActive`, `loadGroup`, `groupLights`.
- Layout: `layout`, `placeIn`, `placeLights`, `suggest` (fewest fixtures reaching target with U₀ ≥ 0.5).
- Polygon geometry: `inPoly`, `polyArea`, `isConvex`, `isSimple`, `insetPoly`, `edgeDist`, `shapePreset`, `normPoly`.
- Drawing: `drawDims`, `drawSection`, `drawOne`, `drawWall`, `ramp` (false-colour scale).
- Persistence: `localStorage` keys `dlc:last` (last state) and `dlc:rooms` (saved rooms).

### Model limits
Direct light only. Room surfaces / reflectance and the radiosity (reflected light) calculation were removed on 2026-11-10 at the user's request; don't reintroduce them unless asked.

## Installed skills

All skills are installed at project level in `.agents/skills/`, symlinked into `.claude/skills/` for Claude Code. Invoke with `/<skill-name>` or let them trigger automatically.

### emilkowalski/skills (18)
Install: `npx skills@latest add emilkowalski/skills`

| Skill | Use for |
|---|---|
| `animate` | Build a web animation from scratch: whether to animate, purpose, tool, properties, curve, duration, interruption, exit. |
| `animate-expo` | Animations in React Native / Expo (Reanimated, Gesture Handler, Expo Router, haptics). |
| `animation-performance` | Keep web animations in the frame budget; fix jank and dropped frames. |
| `animation-vocabulary` | Name a motion effect from a vague description ("the bouncy popover thing" → Pop in). |
| `apple-design` | Apple-style interface design and fluid physical motion, for the web. |
| `ask-sonner` | Sonner (React toast library) setup, usage and troubleshooting. |
| `break-ui` | Stress-test UI with worst-case data and report what breaks, with fixes. |
| `choreograph` | Coordinate several elements animating together (stagger, sequence, hero entrance, morphs). |
| `emil-design-eng` | Emil Kowalski's philosophy on UI polish, component design and animation decisions. |
| `find-animation-opportunities` | Read-only search for places that should animate (and those that shouldn't). |
| `gestures` | Drag, swipe and sheet interactions that track the finger 1:1 and stay interruptible. |
| `improve-animations` | Read-only audit of a codebase's motion, with prioritized implementation plans. |
| `mobile-native` | Make a web app feel native on phones (100vh bug, tap highlight, notch, input zoom, etc.). |
| `pick-ui-library` | Pick the right frontend library from a curated list. Explicit invocation only. |
| `prototype` | Build several distinct versions of a UI piece behind a live picker. Explicit invocation only. |
| `remove-animations` | Remove unnecessary animations; subtract only. |
| `review-animations` | Review motion code against a high craft bar. |
| `write-swift` | Modern Swift: value types, Swift 6 concurrency, generics, API design, testing. |

### Leonxlnx/taste-skill (1)
Install: `npx skills add Leonxlnx/taste-skill`

| Skill | Use for |
|---|---|
| `design-taste-frontend` | Anti-generic frontend design for landing pages and company/product sites, with a browser-based checker and finish gate. |

### impeccable (1 skill + agents + hooks)
Install: `npx impeccable install` (then run `/impeccable init` in chat to set up design context)

| Skill | Use for |
|---|---|
| `impeccable` | Design, redesign, critique, audit, polish or animate a frontend: sites, dashboards, app UI, components, native screens, or a design system (DESIGN.md). |

Also installed:
- Subagents in `.claude/agents/`: `impeccable-asset-producer`, `impeccable-documenter`, `impeccable-finish-reviewer`, `impeccable-manual-edit-applier`.
- Hooks in `.claude/settings.local.json`: runs the impeccable checker on SessionStart, after every Edit/Write (UI checks), and on Stop (design deep pass). Remove the `hooks` block to disable.

### benjitaylor/skills (1)
Install: `npx skills add benjitaylor/skills --skill stageshow`

| Skill | Use for |
|---|---|
| `stageshow` | Faux product UI that looks real, as a still or an animated cursor demo: app/browser windows, dashboards, phones, terminals, bento grids. React and plain CSS. |

## Managing skills

- List: `npx skills list`
- Update: `npx skills update`
- Remove: `npx skills remove <name>`
- Requires Node.js (installed v26.13.0 at `C:\Program Files\nodejs`).
