# REMLUX

Web app for calculating and visualizing how light spreads in a room, with downlights organized in groups, in the spirit of DIALux. For early lighting layout; final results get confirmed in DIALux with the real IES/LDT files.

Project docs, one job each:

| File | Holds | Update when |
|---|---|---|
| `CLAUDE.md` (this file) | Rules for working on the code: workflow, commands, stack, architecture, conventions, verification | A convention or the architecture changes |
| `MEMORY.md` | Business logic: what the app calculates and how, domain rules, ranges, product decisions, reference numbers | A calculation, rule or product decision changes |
| `PROGRESS.md` | Status, roadmap, backlog / known issues, dated log | After every finished task |

## Working rules

- **Start of a session:** read `PROGRESS.md` (current phase, next tasks) and `MEMORY.md` (how the app is supposed to behave).
- **End of a session (or after each finished task):** update `PROGRESS.md`: tick tasks, add a dated log entry with the commit hash, record known issues, bump "Last updated". Record new domain rules or product decisions in `MEMORY.md`.
- **Docs are enforced by a Stop hook** (`.claude/settings.json` + `.claude/hooks/docs-check.sh`): if code under `src/`, `tests/`, `library/`, `index.html` or `package.json` is newer than `PROGRESS.md`, Claude is asked once to update `PROGRESS.md` (and `MEMORY.md` when logic or a decision changed) before finishing.
- **Business logic follows `MEMORY.md`.** If the code and `MEMORY.md` disagree, find out which is right before changing either.
- **Never change calculation results by accident.** Engine arithmetic is locked by tests. If a refactor moves a number, stop and find out why before touching the test.
- **Verify UI changes visually.** For refactors that should not change the look, compare screenshots before/after (see "Verification" below).
- **Run `npm test` and `npm run typecheck` before every commit.** Commit in small steps that each leave the app working.
- **Direct light only** (product decision, see `MEMORY.md`). Don't reintroduce room surfaces / reflectance unless asked.

## Environment

- Windows; Node.js at `C:\Program Files\nodejs`. In Git Bash it may not be on PATH: `export PATH="/c/Program Files/nodejs:$PATH"`.
- Browsers for visual checks: Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`), Chrome.

## Commands

- `npm run dev`: dev server with live reload (http://localhost:5173).
- `npm test`: Vitest (engine unit tests + app smoke test).
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: static site in `dist/`.
- `npm run build:share`: static site without the fixture library in `dist-share/` (for hosting / sending to testers; deploy with `npx vercel deploy dist-share --prod`).
- `npm run build:single`: one self-contained `dist-single/index.html` (portable, like the original single-file app).

## Stack

Vite + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`) + Vitest (jsdom). One runtime dependency: `three` (exact version pinned, `@types/three` dev), used only by the optional three.js render view and loaded lazily with `import('three')` into its own chunk, so the app starts without it. Never import it statically. Everything else is dependency-free; only Google Fonts (Doto, JetBrains Mono).

## Architecture

- `index.html`: markup for the four pages (Tailwind utilities). The pages menu is a left sidebar from `md` up (`<aside>` with logo, `<nav>`, KPI, theme button) and a top bar below it; page panels sit in column 2 (`md:col-start-2`).
- `src/main.ts`: entry; imports the CSS and the app.
- `src/styles.css`: Tailwind theme, base and component styles (see Styling).
- `src/engine/`: **calculation engine**. Pure TypeScript, no DOM, fully unit-tested. Import from `src/engine/index.ts`.
  - `types.ts`: `Pt`, `Poly`, `IntensityFn` (cd vs cos γ), `Formation`.
  - `geometry.ts`: `rectPoly`, `inPoly`, `polyArea`, `polyPerim`, `isConvex`, `edgeDist`, `crosses` (a wall blocks a line of sight), `inwardN`, `insetPoly`, `isSimple`, `shapePreset` (L/T/U), `normalizePoly`.
  - `photometry.ts`: `parseIES` (LM-63, Type C, C-planes averaged; also reads `[MANUFAC]` as `brand`), `reducePlanes` (shared C-plane averaging + flux), `iesIntensity`, `buildModel` (IES or cosⁿ fitted to the beam angle → `Iof` lookup table, beam/field half-angles), `rad`/`deg`.
  - `ldt.ts`: `parseLDT` (EULUMDAT → same curve as IES), `parsePhotometry` (picks IES or LDT by extension, then content).
  - `layout.ts`: `layout` (grid/stagger/hex/perim in a box), `placeLights` (clipped to the room shape), `placeIn` (whole room or a group's area), `areaOf`.
  - `illuminance.ts`: `illuminanceAt` (one fixture, E = I·cos³γ/h²), `directIlluminance` (all lights; walls block in non-convex rooms), `sampleWorkPlane` (grid + Ē/Emin/Emax/U₀ excluding the wall zone), `wallZoneWidth`, `wallScallops`.
  - `calibrate.ts`: floor plan image scale (`scaleFromPoints`, `insideLength`, `pxToPlan` / `planToPx`, `scaleError`).
  - `suggest.ts`: `suggestGrid` (fewest fixtures reaching the target with U₀ ≥ 0.5).
  - `spot.ts`: `pointIlluminance` (aimed source onto any plane), `spotOnWall` (wall grid, beam/field footprint, throw, tilt), `spotLuxAt`.
  - Convention: `shape: Poly | null`, where `null` means a plain L × W rectangle (no clipping).
- `library/<brand>/<type>/*.ies|ldt`: the fixture library (user-supplied photometry files, see `library/README.md`). `src/library/index.ts` finds them with `import.meta.glob` (lazy, bundled at build time; restart dev after adding files). `src/ui/libraryPicker.ts`: Finder-style columns Brand | Type | Fixture (+ search), mounted in the full-width `#libPanel` row on the Fixture page; picking a fixture sets `ies`, brand and name. The 2nd folder level is the type column (for Lucelight it is the product family, e.g. RIO SUB); deeper folders are flattened into it.
- `src/ui/spot.ts`: the standalone **Spot on wall** page (inputs, results, elevation canvas + SVG overlay, side view, dragging; `remlux:spot`). Only legacy hook: `'spot'` in `PAGES`. `src/render/ramp.ts`: TS copy of the lux colour ramp + `kelvinRGB`. `src/render/spot3d.ts`: `drawSpot3D` (wall image mapped onto the wall, cone, spot body; returns a camera for picking: `S`, `onPlaneY`, `onPlaneZ`), `coneOnWall`, `spotHomeView`; uses `attachIsoControls` (which takes an optional `home` view).
- `src/ui/theme.ts`: day / night toggle. Night is the default (the `@theme` tokens); day sets `data-theme="light"` on `<html>`, which swaps the same token names to Catppuccin Latte (`:root[data-theme="light"]` in `src/styles.css`). Choice saved in `localStorage` key `remlux:theme`; an inline script in `index.html` applies it before first paint; a `themechange` event makes the legacy script redraw (the 3D view reads colours at draw time). **New colours must be tokens** (never raw hex in markup or CSS) so both modes work; the heat map ramp and the `#fff` / `#16161e` overlays drawn on it stay fixed in both modes.
- `src/ui/planImage.ts`: floor plan image in its own card on the Room page (load, scale calibration, check). One hook in legacy: `fitRoom`.
- `src/render/three/` + `src/ui/threeViewport.ts` + `src/ui/roomThree.ts`: the optional **three.js render view** (a `three.js render view` toggle button in each 3D viewport: `#isoRender`, `#spRender`; state in `localStorage` `remlux:three`). `camera.ts` (pure, tested): `orthoParams` builds an OrthographicCamera from the same `IsoView` + `IsoProj` the 2D draw resolved, so orbit/pan/zoom, picking (`cam3.S/onPlaneY/onPlaneZ`) and the 2D overlay keep working unchanged; app axes (x, y, z up) map to three (x, z, y). `layer.ts`: `ThreeLayer` (WebGL canvas placed under the 2D canvas, render on demand, no loop; `dispose` frees GPU memory + `forceContextLoss`). `roomScene.ts` / `spotScene.ts`: scene builders, unlit `MeshBasicMaterial` only (the views show calculated light; no lights, shadows or tone mapping; textures are sRGB). In three mode the 2D draws run with `threeMode: true` (labels, handles, guide lines only). `createThreeViewport` handles toggling, lazy load, persistence, `invalidate()` (scene content rebuilt on next present) and fallback to the 2D view on any failure (no WebGL, context lost). **New 3D scene content goes in the scene builders, and any 2D-only drawing must be skipped under `threeMode`.**
- `src/render/iso.ts`: 3D view with a free orthographic camera. `drawIso` (pure canvas drawing; takes the 2D heat map canvas, light positions and an `IsoView` {yaw, pitch, zoom, pan}) and `attachIsoControls` (mouse/touch: orbit, pan, zoom, reset; redraws at most once per frame), `sizeCanvas` (resizes the canvas backing store only when the size changed; use it for every canvas drawn per frame). Called from `drawIso3d` in the legacy script. Default view is true isometric.
- `src/legacy/app.js`: UI, state, drawing and events (plain JS, not type-checked, ES module). Imports the engine through thin wrappers (`model`, `placeLights`, `placeIn`, `wzone`, `normPoly`, `suggest`) that read on-screen inputs and the global `poly`. Being split into `src/state/`, `src/render/`, `src/ui/` (see `PROGRESS.md`). **New code goes in TypeScript in those folders, not in `legacy/`.**
  - `calc()`: main calculation + render pass. Groups: `groups`, `act`, `renderGroups`, `snapGroup`, `saveActive`, `loadGroup`, `groupLights`. Drawing: `drawDims`, `drawSection`, `drawOne`, `drawWall`, `ramp` (false-colour scale).
  - Persistence: `localStorage` keys `dlc:last` (last state) and `dlc:rooms` (saved rooms). Old saves must keep loading.
- `tests/engine/*.test.ts`: physics unit tests. `tests/fixtures/*.ies|ldt`: small IES/LDT files. `tests/library.test.ts`: library entries and picker. `tests/threeCamera.test.ts`: the three.js camera projects like the 2D view. `tests/app.smoke.test.ts`: boots the app and checks the default-room headline numbers.
- `REMLUX_MD.md`: the app's UI text and method notes as Markdown (copy of the page text, not code).

### App pages
Five pages (`room`, `fixture`, `visualize`, `stats`, `spot`, switched by `showPage`, URL hash):
- **Room**: shape (rectangle, L/T/U presets, or custom polygon), length/width/height, work plane height, wall zone excluded (EN 12464-1: 0.5 m), saved rooms.
- **Fixture**: per group: IES/LDT file, fixture library picker, or generic cosⁿ beam, beam angle, lumens, optional watts, downlight radius, laid out as one wide horizontal card (the one-downlight views live on Visualize).
- **Visualize** (Cinema 4D-style layout: plan and views in the wide left column, Groups and settings in a 280 px right sidebar; sidebar first on phones): groups, formation, placement area, columns/rows or spacing, Suggest; floor plan heatmap (`#cv` canvas + `#ov` SVG; lights draggable → Custom layout; Shift-drag or "Move whole group" moves a group, the corner handle / ±10% buttons scale its spacing), vertical tool rail left of the floor plan (layers, 3D view, draw / edit room), section, one-downlight views (`#oneHeat`, `#oneProf`, `#oneLegend`), wall scallops (`#wcv` / `#wov`).
- **Spot on wall** (standalone): one aimed spotlight (x, y, z + aim point on the wall), beam angle / lumens or IES/LDT, watts, size, CCT; results, 3D view of the wall (Lighting effect / Lux map), side view, Reset to defaults.
- **Stats**: scope buttons (All groups, or one per group), results, work plane table (Ē, Emin, Emax, U₀, Ud), lux histogram, each downlight, spec summary, method.

## Reference numbers

The default-room numbers (330 lx avg, U₀ 0.74, …) are listed in `MEMORY.md` and locked in `tests/app.smoke.test.ts`.

## Styling (Tailwind v4)

- Everything is in `src/styles.css`: `@theme` tokens, `@layer base` element defaults, `@layer components` for pieces the script builds as HTML strings or toggles by class. No `tailwind.config.js` (v4 is CSS-first).
- **Only the project palette exists** (Tokyo Night; default Tailwind colours are switched off): `paper` (page), `panel`, `raise`, `ink` (text), `mute`, `rule` (borders), `beam` (light/amber), `accent` (blue), `accent2` (purple), `ok`, `bad`, `title` (the REMLUX logo: one flat off-white in night mode, dark text in day mode; never two-tone). Use `bg-panel`, `text-mute`, `border-rule`…, never raw hex in markup.
- Fonts: `font-mono` (JetBrains Mono, body), `font-display` (Doto, logo). Breakpoints: `sm` = 560px, `md` = 840px (sidebar layout); `max-[480px]:` for small phones.
- The script writes `var(--ink)`, `var(--panel)`, `var(--accent)`… into inline SVG; those short aliases are defined in `:root` from the theme. Keep them when renaming tokens.
- Component classes for script-generated markup: `panel`, `note`, `err`, `chip` (`aria-pressed=true` = selected; `chip tool` = square icon-only button with an `.ic` SVG, always give it `aria-label` and `title`), `actions`, `results`/`res`/`res hero`, `glist`/`grow`/`gsel`/`gtog`, `saved`, `stage`, `planwrap`, `upd`/`primary`, `pblur`, `num`.
- Hook classes the script queries (don't remove; `.legend` is for the floor plan only, the first match in the DOM is used): `.tab`, `.legend`, `.upd`, `.grpHost`, `.grow`, `.gsel`, `.gname`, `[data-l]`.
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
