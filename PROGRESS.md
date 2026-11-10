# REMLUX: Progress

Living status of the project. **Update this file at the end of every work session**: tick tasks, add a log entry, move items between sections. Stable facts and conventions live in `CLAUDE.md`, not here.

_Last updated: 2026-11-11_

## Status

| | |
|---|---|
| **Current phase** | Step 4: split `src/legacy/app.js` into typed `state/`, `render/`, `ui/` modules |
| **App** | Working. Direct light only. Same results as the original single-file app. |
| **Tests** | 64 passing (`npm test`): 60 engine unit tests + 4 smoke tests |
| **Build** | `npm run build` (static site) and `npm run build:single` (one HTML file) both work |
| **Hosting** | Not set up yet |

## Roadmap

### 1. Version control ✅
- [x] `git init`, `.gitignore` (agent tooling and local settings excluded), first commit of the original file

### 2. Project setup ✅
- [x] Vite + TypeScript (strict) + Vitest (jsdom)
- [x] Split the single HTML file into `index.html`, `src/styles.css`, `src/legacy/app.js`
- [x] Smoke test locking the default-room numbers
- [x] Single-file build (`npm run build:single`)

### 3. Calculation engine ✅
- [x] `src/engine/`: geometry, photometry (IES + cosⁿ), layout, illuminance, suggest
- [x] Legacy script calls the engine through thin wrappers
- [x] 60 unit tests on the physics
- [x] Verified identical output to the original across 9 scenarios

### 3b. Tailwind CSS v4 ✅
- [x] `@tailwindcss/vite`, theme tokens in `src/styles.css`, default palette switched off
- [x] Static layout in `index.html` converted to utilities; script-generated pieces kept as component classes
- [x] Pixel-compared with the original in Edge: 14/16 identical, 2 differ only by an intended fix

### 4. Split the UI script ⏳ next
- [ ] `src/state/`: typed `AppState`, groups, versioned `localStorage` (new key, e.g. `remlux:v1`) with migration from `dlc:last` / `dlc:rooms` so old saved rooms keep loading
- [ ] `src/render/`: floor plan heatmap + overlay, dimensions, section, one downlight, wall scallops, histogram, result cards, tables
- [ ] `src/ui/`: page tabs, chips, inputs + "Inputs changed" bar, group list, light and corner dragging, saved rooms
- [ ] Delete `src/legacy/app.js`
- [ ] Move the visual-regression scripts into the repo (see Backlog) and run them before/after

### 5. Hosting
- [ ] Choose host (Cloudflare Pages / Netlify / GitHub Pages) and deploy `dist/`
- [ ] Optional PWA (offline use on site)

### 6. Features
- [ ] LDT (EULUMDAT) files
- [ ] Full C-plane IES (asymmetric fixtures) instead of the rotational average
- [ ] PDF export of the spec summary / plan

## Backlog and known issues

- **Visual regression scripts live in a temp folder.** The Edge screenshot capture/compare scripts (Playwright-core + pixelmatch) used for the Tailwind check were written to `%TEMP%\remlux_shots`. Move them into the repo (e.g. `tools/visual/`) before step 4.
- **`src/legacy/app.js` is not type-checked.** It is resolved by step 4.
- **Saved data has no version.** `localStorage` keys `dlc:last` and `dlc:rooms` (step 4).
- **IES is rotationally averaged.** Asymmetric fixtures (wall washers, linear) are approximated (step 6).
- **Lux is direct only.** Real rooms measure brighter because of reflections. This is by decision (see Decisions); the app says so in its Method note.
- **Node is not on PATH in Git Bash.** Use `export PATH="/c/Program Files/nodejs:$PATH"`. A new terminal fixes it in PowerShell.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Remove room surfaces / reflectance and the radiosity calculation; direct light only | User request |
| 2026-11-10 | Vite + TypeScript, keep the UI as plain JS for now (no React/Svelte) | Lowest-risk path; a framework can come later if state gets painful |
| 2026-11-10 | Extract the engine first, keep its arithmetic identical | Results stay comparable with the original; tests lock them |
| 2026-11-11 | Tailwind CSS v4, project palette only, component classes for script-built HTML | User request; keeps the design system strict and the migration verifiable |
| 2026-11-11 | Keep the two fixes found during the Tailwind check rather than reproduce the old look | Both were bugs (see log) |

## Log

### 2026-11-11
- **PROGRESS.md + CLAUDE.md split** (8ac13cf): progress tracking moved out of CLAUDE.md; CLAUDE.md now holds working rules, architecture, conventions, reference numbers and verification method.
- **Tailwind CSS v4** (`3f306b9`): stylesheet rewritten as theme tokens + base + components; `index.html` layout in utilities. Pixel-identical to the original in 14/16 screenshots.
  - Fixed: the corner-coordinates textarea overflowed its panel by 22 px (it was `content-box` inside `<details>`).
  - Fixed: the progressive blur at the screen edges had stopped working in the step 2 build (Vite's CSS minifier dropped the `backdrop-filter`); it works again.
- **Calculation engine** (`819dd96`): maths moved to `src/engine/` with 60 unit tests. Output compared field by field with the original app in 9 scenarios: identical.

### 2026-11-10
- **Project setup** (`a8c00b2`): Vite + TypeScript + Vitest, file split, smoke test, single-file build.
- **Git** (`b9c82f2`): repository created; original app committed.
- Room surfaces / reflectance and radiosity removed from the app (before git; included in the first commit).
- Node.js LTS installed; agent skills installed (emilkowalski/skills, taste-skill, impeccable, stageshow).
