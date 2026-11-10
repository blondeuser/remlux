# REMLUX

Web app for calculating and visualizing how light spreads in a room, with downlights organized in groups, in the spirit of DIALux. For early lighting layout; final results get confirmed in DIALux with the real IES/LDT files.

This file is the project's **memory**: stable facts, conventions and rules. Status, roadmap, history and open issues are in **`PROGRESS.md`**.

## Working rules

- **Start of a session:** read `PROGRESS.md` to see the current phase and next tasks.
- **End of a session (or after each finished task):** update `PROGRESS.md`: tick tasks, add a dated log entry with the commit hash, record new decisions and known issues, bump "Last updated". Keep this file (`CLAUDE.md`) for things that stay true; update it only when a convention or the architecture changes.
- **Never change calculation results by accident.** Engine arithmetic is locked by tests. If a refactor moves a number, stop and find out why before touching the test.
- **Verify UI changes visually.** For refactors that should not change the look, compare screenshots before/after (see "Verification" below).
- **Run `npm test` and `npm run typecheck` before every commit.** Commit in small steps that each leave the app working.
- **Direct light only.** Room surfaces / reflectance and radiosity were removed at the user's request. Don't reintroduce them unless asked.

## Environment

- Windows; Node.js at `C:\Program Files\nodejs`. In Git Bash it may not be on PATH: `export PATH="/c/Program Files/nodejs:$PATH"`.
- Browsers for visual checks: Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`), Chrome.

## Commands

- `npm run dev`: dev server with live reload (http://localhost:5173).
- `npm test`: Vitest (engine unit tests + app smoke test).
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: static site in `dist/`.
- `npm run build:single`: one self-contained `dist-single/index.html` (portable, like the original single-file app).

## Stack

Vite + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`) + Vitest (jsdom). No runtime JS dependencies; only Google Fonts (Doto, JetBrains Mono).

## Architecture

- `index.html`: markup for the four pages (Tailwind utilities).
- `src/main.ts`: entry; imports the CSS and the app.
- `src/styles.css`: Tailwind theme, base and component styles (see Styling).
- `src/engine/`: **calculation engine**. Pure TypeScript, no DOM, fully unit-tested. Import from `src/engine/index.ts`.
  - `types.ts`: `Pt`, `Poly`, `IntensityFn` (cd vs cos γ), `Formation`.
  - `geometry.ts`: `rectPoly`, `inPoly`, `polyArea`, `polyPerim`, `isConvex`, `edgeDist`, `crosses` (a wall blocks a line of sight), `inwardN`, `insetPoly`, `isSimple`, `shapePreset` (L/T/U), `normalizePoly`.
  - `photometry.ts`: `parseIES` (LM-63, Type C, C-planes averaged), `iesIntensity`, `buildModel` (IES or cosⁿ fitted to the beam angle → `Iof` lookup table, beam/field half-angles), `rad`/`deg`.
  - `layout.ts`: `layout` (grid/stagger/hex/perim in a box), `placeLights` (clipped to the room shape), `placeIn` (whole room or a group's area), `areaOf`.
  - `illuminance.ts`: `illuminanceAt` (one fixture, E = I·cos³γ/h²), `directIlluminance` (all lights; walls block in non-convex rooms), `sampleWorkPlane` (grid + Ē/Emin/Emax/U₀ excluding the wall zone), `wallZoneWidth`, `wallScallops`.
  - `suggest.ts`: `suggestGrid` (fewest fixtures reaching the target with U₀ ≥ 0.5).
  - Convention: `shape: Poly | null`, where `null` means a plain L × W rectangle (no clipping).
- `src/legacy/app.js`: UI, state, drawing and events (plain JS, not type-checked, ES module). Imports the engine through thin wrappers (`model`, `placeLights`, `placeIn`, `wzone`, `normPoly`, `suggest`) that read on-screen inputs and the global `poly`. Being split into `src/state/`, `src/render/`, `src/ui/` (see `PROGRESS.md`). **New code goes in TypeScript in those folders, not in `legacy/`.**
  - `calc()`: main calculation + render pass. Groups: `groups`, `act`, `renderGroups`, `snapGroup`, `saveActive`, `loadGroup`, `groupLights`. Drawing: `drawDims`, `drawSection`, `drawOne`, `drawWall`, `ramp` (false-colour scale).
  - Persistence: `localStorage` keys `dlc:last` (last state) and `dlc:rooms` (saved rooms). Old saves must keep loading.
- `tests/engine/*.test.ts`: physics unit tests. `tests/fixtures/*.ies`: small IES files. `tests/app.smoke.test.ts`: boots the app and checks the default-room headline numbers.
- `REMLUX_MD.md`: the app's UI text and method notes as Markdown (copy of the page text, not code).

### App pages
Four pages (`room`, `fixture`, `visualize`, `stats`, switched by `showPage`, URL hash):
- **Room**: shape (rectangle, L/T/U presets, or custom polygon), length/width/height, work plane height, wall zone excluded (EN 12464-1: 0.5 m), saved rooms.
- **Fixture**: per group: IES file or generic cosⁿ beam, beam angle, lumens, optional watts, downlight radius; one-downlight views.
- **Visualize**: groups, formation, placement area, columns/rows or spacing, Suggest; floor plan heatmap (`#cv` canvas + `#ov` SVG; lights draggable → Custom layout), section, wall scallops (`#wcv` / `#wov`).
- **Stats**: results, work plane table (Ē, Emin, Emax, U₀, Ud), lux histogram, each downlight, spec summary, method.

## Reference numbers (default room)

6 × 4.5 × 2.8 m, 4 × 3 grid, 800 lm, 36° → **330 lx avg, Emin 244, Emax 378, U₀ 0.74**; 241 lx under one fixture; wall scallop peak 405 lx; Suggest for 300 lx → 4 × 3 (≈332 lx). These are locked in `tests/app.smoke.test.ts`.

## Styling (Tailwind v4)

- Everything is in `src/styles.css`: `@theme` tokens, `@layer base` element defaults, `@layer components` for pieces the script builds as HTML strings or toggles by class. No `tailwind.config.js` (v4 is CSS-first).
- **Only the project palette exists** (Tokyo Night; default Tailwind colours are switched off): `paper` (page), `panel`, `raise`, `ink` (text), `mute`, `rule` (borders), `beam` (light/amber), `accent` (blue), `accent2` (purple), `ok`, `bad`. Use `bg-panel`, `text-mute`, `border-rule`…, never raw hex in markup.
- Fonts: `font-mono` (JetBrains Mono, body), `font-display` (Doto, logo). Breakpoints: `sm` = 560px, `md` = 840px (sidebar layout); `max-[480px]:` for small phones.
- The script writes `var(--ink)`, `var(--panel)`, `var(--accent)`… into inline SVG; those short aliases are defined in `:root` from the theme. Keep them when renaming tokens.
- Component classes for script-generated markup: `panel`, `note`, `err`, `chip` (`aria-pressed=true` = selected), `actions`, `results`/`res`/`res hero`, `glist`/`grow`/`gsel`/`gtog`, `saved`, `stage`, `planwrap`, `upd`/`primary`, `pblur`, `num`.
- Hook classes the script queries (don't remove): `.tab`, `.legend`, `.upd`, `.grpHost`, `.grow`, `.gsel`, `.gname`, `[data-l]`.
- Gotchas found during the migration: Chrome's `<details>` content wrapper breaks `box-sizing: inherit`; Vite's default CSS minifier once dropped `backdrop-filter: blur(var(--b))`.

## Verification

- **Numbers:** `npm test`. For bigger refactors, also compare the app's output field by field against the previous version in several scenarios (shaped rooms, each formation, IES, custom points, multiple groups with areas).
- **Look:** full-page screenshots in Edge with Playwright-core (4 pages × 400/1280 px × default and multi-group states), compared with pixelmatch. Wait for the web fonts explicitly (`document.fonts.load(...)`) or text renders in the fallback font and every screenshot "differs". Compare against the original file in git (`git show b9c82f2:REMLUX_HTML.html`) when in doubt.

## Agent tooling

Installed at project level and git-ignored (machine-local): `.agents/`, `.codex/`, `.claude/skills/`, `.claude/agents/`, `.claude/settings.local.json`. Restore on a fresh clone: `npx skills experimental_install` (skills in `skills-lock.json`), then `npx impeccable install`. Manage with `npx skills list | update | remove <name>`.

| Skill | Use for |
|---|---|
| `animate`, `choreograph`, `gestures`, `animation-performance` | Building and tuning web motion |
| `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations` | Auditing motion (review, plan, find, subtract) |
| `emil-design-eng`, `apple-design`, `mobile-native` | UI polish, Apple-style interaction, native feel on phones |
| `break-ui` | Stress-test UI with worst-case data |
| `animation-vocabulary`, `pick-ui-library`, `prototype` | Naming effects, choosing libraries, multi-variant prototypes (last two: explicit invocation only) |
| `ask-sonner`, `animate-expo`, `write-swift` | Sonner toasts, React Native/Expo, Swift (not used in this project) |
| `design-taste-frontend` | Anti-generic frontend design with a browser checker |
| `impeccable` | Design, critique, audit, polish a frontend; `/impeccable init` sets up design context |
| `stageshow` | Faux product UI stills and cursor demos |

Sources: `emilkowalski/skills` (18), `Leonxlnx/taste-skill`, `impeccable` (also adds 4 subagents in `.claude/agents/` and hooks in `.claude/settings.local.json` that run its design checker on SessionStart, after Edit/Write, and on Stop), `benjitaylor/skills --skill stageshow`.
