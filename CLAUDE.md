# REMLUX

## Project

REMLUX is a web app for calculating and visualizing how light spreads in a room, with luminaires organized in groups, in the spirit of DIALux. It is meant for early lighting layout; final results get confirmed in DIALux with the real IES/LDT files.

Stack: Vite + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`) + Vitest (jsdom). No runtime JS dependencies; only Google Fonts (Doto, JetBrains Mono).

### Styling (Tailwind v4)
- `src/styles.css` holds everything: `@theme` tokens, `@layer base` element defaults, `@layer components` for pieces the script builds as HTML strings or toggles by class. No `tailwind.config.js` (v4 is CSS-first).
- Only the project palette exists (default Tailwind colours are switched off): `paper` (page), `panel`, `raise`, `ink` (text), `mute`, `rule` (borders), `beam` (light/amber), `accent` (blue), `accent2` (purple), `ok`, `bad`. Use `bg-panel`, `text-mute`, `border-rule`… never raw hex in markup.
- Fonts: `font-mono` (JetBrains Mono, the body font), `font-display` (Doto, the logo). Breakpoints: `sm` = 560px, `md` = 840px (sidebar layout); `max-[480px]:` for small phones.
- The script writes `var(--ink)`, `var(--panel)`, `var(--accent)`… into inline SVG; those short aliases are defined in `:root` from the theme. Keep them when renaming tokens.
- Static layout in `index.html` uses utilities. Keep component classes for script-generated markup: `panel`, `note`, `err`, `chip` (`aria-pressed=true` = selected), `actions`, `results`/`res`/`res hero`, `glist`/`grow`/`gsel`/`gtog`, `saved`, `stage`, `planwrap`, `upd`/`primary`, `pblur`, `num`.
- Hook classes the script queries; don't remove: `.tab`, `.legend`, `.upd`, `.grpHost`, `.grow`, `.gsel`, `.gname`, `[data-l]`.
- The Tailwind migration was checked pixel-for-pixel against the original HTML in Edge (4 pages × 2 widths × 2 states: identical except the fixed textarea overflow below). Node.js is at `C:\Program Files\nodejs` (may need adding to PATH in Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`).

### Commands
- `npm run dev`: dev server with live reload (http://localhost:5173).
- `npm test`: Vitest. Run after every change to the maths.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: static site in `dist/` (deploy anywhere static).
- `npm run build:single`: one self-contained `dist-single/index.html` (like the original single-file app; good for sharing or publishing as an artifact).

### Layout
- `index.html`: markup only (the four pages).
- `src/styles.css`: all CSS.
- `src/main.ts`: entry; imports the CSS and the app.
- `src/engine/`: the calculation engine. Pure TypeScript (strict), no DOM, fully unit-tested. Import from `src/engine/index.ts`.
  - `types.ts`: `Pt`, `Poly`, `IntensityFn` (cd vs cos γ), `Formation`.
  - `geometry.ts`: `rectPoly`, `inPoly`, `polyArea`, `polyPerim`, `isConvex`, `edgeDist`, `crosses` (wall blocks a line of sight), `inwardN`, `insetPoly`, `isSimple`, `shapePreset` (L/T/U), `normalizePoly`.
  - `photometry.ts`: `parseIES` (LM-63, Type C, C-planes averaged), `iesIntensity`, `buildModel` (IES or cosⁿ fitted to beam angle → `Iof` lookup table, beam/field half-angles), `rad`/`deg`.
  - `layout.ts`: `layout` (grid/stagger/hex/perim in a box), `placeLights` (clipped to the room shape), `placeIn` (whole room or a group's area), `areaOf`.
  - `illuminance.ts`: `illuminanceAt` (one fixture, E = I·cos³γ/h²), `directIlluminance` (all lights, walls block in non-convex rooms), `sampleWorkPlane` (grid + Ē/Emin/Emax/U₀ excluding the wall zone), `wallZoneWidth`, `wallScallops`.
  - `suggest.ts`: `suggestGrid` (fewest fixtures reaching the target with U₀ ≥ 0.5).
  - Convention: `shape: Poly | null` where `null` means a plain L × W rectangle (no clipping). Keep the arithmetic exactly as is unless a change is intended; results are locked by tests.
- `src/legacy/app.js`: UI, state, drawing and event wiring (plain JS, not type-checked, ES module in strict mode). Imports the engine; `model()`, `placeLights()`, `placeIn()`, `wzone()`, `normPoly()`, `suggest()` are thin wrappers that read on-screen inputs and the global `poly`. Still to split into `src/render/`, `src/ui/`, `src/state/`. New code goes in TypeScript in those folders, not in `legacy/`.
- `tests/engine/*.test.ts`: unit tests of the physics (flux conservation, 50%/10% beam edges, inverse-square/cos³, wall blocking, layouts, Suggest). `tests/fixtures/*.ies`: small IES files.
- `tests/app.smoke.test.ts`: boots the whole app with defaults and checks the headline numbers (330 lx avg, U 0.74, 405 lx wall peak, Suggest 4 × 3). If a refactor changes these, the maths changed; investigate before updating them.
- `REMLUX_MD.md`: the app's UI text and method notes as plain Markdown (a copy of the page's copy, not code).
- The original `REMLUX_HTML.html` is in git history (first commit).

### Refactor plan (in order, app working after each step)
1. ~~git~~ ✓  2. ~~Vite + TS scaffold~~ ✓  3. ~~Maths into `src/engine/` with tests~~ ✓ (verified identical output to the original app across 9 scenarios: L/U/T rooms, hex/stagger/perimeter, fixed spacing, IES, custom points, multiple groups with areas)
4. Split rendering and UI into modules; version the localStorage state so old saved rooms keep loading.
5. Static hosting (Cloudflare Pages / Netlify / GitHub Pages), optional PWA for offline use.
6. New features: LDT files, full C-plane IES, PDF export.

### App structure
Four pages (`PAGES = ['room','fixture','visualize','stats']`, switched by `showPage`):
- **Room**: shape (rectangle, presets, or custom polygon from corner coordinates), length/width/height, work plane height, wall zone excluded (EN 12464-1: 0.5 m), saved rooms.
- **Fixture**: per group: light distribution (loaded IES file or generic cosⁿ fitted to beam angle), lumens, optional watts, downlight radius; grid formation, placement rectangle, columns/rows or spacing; "Suggest a grid for a target" lux.
- **Visualize**: floor plan heatmap (`#cv` canvas + `#ov` SVG overlay; lights draggable → switches layout to Custom), section along the length, wall scallops (`#wcv` / `#wov`).
- **Stats**: work plane table (Ē, Emin, Emax, U₀ = Emin/Ē, Ud = Emin/Emax), lux distribution, each downlight, spec summary, method.

### Key functions in `src/legacy/app.js` (engine functions are listed under Layout above)
- `calc()`: main calculation + render pass.
- `model(q)`: wraps `buildModel` for the selected group (on-screen inputs) or a stored group `q`.
- Groups: `groups`, `act`, `renderGroups`, `snapGroup`, `saveActive`, `loadGroup`, `groupLights`.
- `suggest()`: validates inputs, calls `suggestGrid`, renders the result.
- `normPoly()`: wraps `normalizePoly`, shifts custom points, updates Length/Width inputs.
- Drawing: `drawDims`, `drawSection`, `drawOne`, `drawWall`, `ramp` (false-colour scale).
- Persistence: `localStorage` keys `dlc:last` (last state) and `dlc:rooms` (saved rooms).

### Model limits
Direct light only. Room surfaces / reflectance and the radiosity (reflected light) calculation were removed on 2026-11-10 at the user's request; don't reintroduce them unless asked.

## Installed skills

All skills are installed at project level in `.agents/skills/`, symlinked into `.claude/skills/` for Claude Code. Invoke with `/<skill-name>` or let them trigger automatically.

### Restoring agent tooling
`.agents/`, `.codex/`, `.claude/skills/`, `.claude/agents/` and `.claude/settings.local.json` are git-ignored (machine-local). On a fresh clone: `npx skills experimental_install` (restores the skills listed in `skills-lock.json`), then `npx impeccable install` (impeccable skill, agents and hooks).

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
