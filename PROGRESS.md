# REMLUX: Progress

Living status of the project. **Update this file at the end of every work session**: tick tasks, add a log entry, move items between sections. Rules and conventions live in `CLAUDE.md`; business logic (calculations, domain rules, product decisions) in `MEMORY.md`.

_Last updated: 2026-11-12_

## Status

| | |
|---|---|
| **Current phase** | Step 4: split `src/legacy/app.js` into typed `state/`, `render/`, `ui/` modules |
| **App** | Working. Direct light only. Same results as the original single-file app. |
| **Tests** | 96 passing (`npm test`) |
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
- [x] LDT (EULUMDAT) files
- [x] Fixture library (`library/<brand>/`) with picker on the Fixture page; **waiting for real brand files** (Erco, iGuzzini, Lucelight…)
- [x] **Spot on wall** page (standalone spotlight projection on a wall), 2026-11-12
- [ ] Full C-plane IES (asymmetric fixtures) instead of the rotational average
- [ ] PDF export of the spec summary / plan
- [ ] **Floor plan from an image** (core feature, researched 2026-11-11; see Decisions): upload PNG / JPG of an existing plan that has dimensions, get a room polygon in real metres.
  - [x] Phase 1, manual and exact (done 2026-11-11, `src/ui/planImage.ts` + `src/engine/calibrate.ts`): image in its own card above the plan (not overlaid), calibrate scale from a printed dimension (two clicks + typed length, dimension basis inside / centre / outside + wall thickness), check another dimension (% error, warns above 2 %), room box resized to the image, trace with the existing draw / edit tool. Not done from the original wording: lock, levelling/rotation, image not persisted. Original plan: image as plan background (opacity, lock), level it, calibrate scale from one printed dimension (two clicks + typed length), check against a second dimension (show % error), trace with the existing draw / edit tool with snapping; dimension basis option (inside face / wall centre / outside + wall thickness). Zero dependencies.
  - Input decided 2026-11-11: **CAD screenshots with a dimension written beside each wall** (clean, axis-aligned, no perspective). So: calibrate from many labels at once (median px per m, residual per wall as the accuracy check), and rebuild the polygon from the labelled wall lengths (right angles assumed) so the result does not depend on click accuracy; the image only supplies the layout. Still open: which wall face the numbers refer to, whether cloud AI is acceptable.
  - Furniture, doors and text on the plan (decided 2026-11-11): do not affect Phase 1 or the labelled-length rebuild; they break the click-inside flood fill (bites, door leaks) and add stray numbers for OCR. Plan: upload hint to hide the furniture layer in CAD before the screenshot; thick-stroke filter so walls survive and furniture does not (needs a real sample to tune); show every OCR number as a highlight and let the user pick the wall dimensions; user closes door gaps. Furniture stays display-only (no shadow or surface calculation); footprints as light placement areas is a later idea.
  - [ ] Phase 2, assisted: seed-click flood fill to outline a room (canvas only), simplify and square the outline; OCR of dimension labels to suggest the scale, user confirms.
  - [ ] Phase 3, optional: perspective correction for photos (4-corner homography); vector PDF import for exact geometry; auto wall detection only if Phase 1-2 prove too slow for users.

## Backlog and known issues

- **The library is bundled at build time, and it is big now.** `library/` holds 378 MB / 14,118 Lucelight files: `npm run build` works (about 9 s) but outputs 14,121 files / 387 MB plus a 3 MB main chunk, and `build:single` would inline all of it. Fix before hosting: generate a small index (brand, type, name, lm, W, beam) and serve the photometry files as static assets fetched on demand, not as JS chunks. Also decide whether `library/` is committed (it is untracked, and needs the manufacturer's licence check) or git-ignored.
- **Folder name is the brand label.** `LUCELIGHT_Photometric_Data_IES` shows as "LUCELIGHT Photometric Data IES"; rename the folder to `Lucelight` for a clean label.

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
| 2026-11-11 | Day mode uses Catppuccin Latte; night (Tokyo Night) stays the default | User request |
| 2026-11-11 | Furniture is display-only: no shadows, no surface illuminance (also in MEMORY.md) | User decision; keeps the engine direct-light, work-plane only |
| 2026-11-11 | Floor plan from image: manual calibrated tracing first, automation only as a helper the user confirms | Accuracy comes from the scale calibration and the user's clicks; published auto-vectorization generalises poorly to real plans (see research notes in the 2026-11-11 log) |
| 2026-11-11 | Keep the two fixes found during the Tailwind check rather than reproduce the old look | Both were bugs (see log) |

## Log

### 2026-11-12
- **three.js render view** (uncommitted): a toggle button in each 3D viewport (room *3D view*, *Wall in 3D*) switches the drawing to three.js 0.186.0 (new dependency, lazy chunk of 187 kB gzipped; `import('three')` only on first use). A WebGL canvas sits under the 2D canvas; the camera is derived from the existing `IsoView` (tested: matches the 2D projection in 4 views), so orbit/pan/zoom, picking and drags are unchanged and the 2D canvas only draws labels and handles (`threeMode`). Unlit materials (colours stay equal to the lux legend), instanced downlights (a few draw calls per group), on-demand rendering, GPU memory freed on toggle off. Falls back to the 2D view if WebGL fails. Checked in Chrome (room + spot, night + day, floor-ring and Shift drag, Reset transform, persistence after reload). Not done: no automated visual test of the WebGL output (jsdom has no WebGL); the spot body is small at default size and mostly hidden by its grab ring. `build:single` is 380 MB because the fixture library is inlined (unchanged by this; three adds ~0.7 MB).
- **3D viewport review + Spot on wall transform** (uncommitted): the 3D views are canvas-2D (no three.js), so the review applied the general render rules. Done: camera input redraws at most once per frame (`attachIsoControls`), drags on Spot on wall recalculate once per frame, canvas backing store resized only when the size changes (`sizeCanvas`, was reallocated every frame), `localStorage` save debounced 250 ms (it holds the IES curve). Spot y was locked in 3D (spot moved only parallel to the wall): now Shift + drag the spot, or drag the ring on the floor under it, moves x / y (`onPlaneZ`, tested); **Reset transform** button restores position and aim only. Not done: room 3D view still redraws the full heat map each frame (cheap at current sizes).
- **Spot on wall: 3D view + Reset** (uncommitted): the flat wall elevation is now a 3D view (`src/render/spot3d.ts`): lit wall (Lighting effect / Lux map mapped onto it), floor strip with grid, spot body along the beam axis, beam cone, 50% / 10% outlines, drop lines, size labels; orbit / pan / zoom / home handles and mouse controls reused from the room 3D view (`attachIsoControls` got an optional `home` view; legacy call unchanged). Aim cross and spot stay draggable in 3D (exact inverse of the orthographic camera onto the wall plane / the spot's plane), hover lux readout kept. *Reset to defaults* button in the Wall card. Checked in Chrome at 1280 / 400 px, night and day: drags, orbit, hover and reset. 91 tests pass (2 new for the outline geometry), typecheck clean.
- **Spot on wall page** (uncommitted): new 5th tab `#spot`, standalone from the room. Set the spot position (x along, y out, z height), an aim point on the wall, beam angle + lumens (or load IES / LDT), watts, spot size Ø, CCT, wall width × height. Results: lux at aim, peak, beam average, beam / field footprint, throw, tilt, cd, lm/W. Wall elevation as Lighting effect (CCT-tinted render) or Lux map with scale chips, exact 50% / 10% outlines, hover lux readout, draggable aim cross and spot; side view with draggable spot. Engine `src/engine/spot.ts` (7 tests, incl. "aimed down = downlight formula"); UI `src/ui/spot.ts`; `src/render/ramp.ts`. Checked in Chrome at 1280 / 400 px, night and day; drags and IES load tested. 89 tests pass, typecheck clean. Ideas: several spots on one wall, spot on the floor / ceiling, link to the room walls, export image.

### 2026-11-11
- **Share build for testers**: `npm run build:share` -> `dist-share/` (240 KB, 4 files), the normal static site without the 378 MB fixture library (`vite.config.ts` swaps `src/library/sources.ts` for `sources.empty.ts` in `--mode share`; the picker shows its empty state, testers load their own IES / LDT). Deployed to Vercel production (project `remlux`, public alias https://remlux-omega.vercel.app) from a copy of `dist-share/` via `npx vercel deploy --prod`; the long `*-vihaoflk-9754.vercel.app` URLs are behind Vercel login (302). Redeploy the same way. Not committed.
- **Floor plan image card moved from Visualize to the Room page** (right column, above Saved rooms), since the image sets up the room. Markup move only; the script finds the elements by id.
- **Sidebar alignment**: on `md` and up the page cards start below the logo, level with the top of the menu (`md:mt-[calc(2.2rem+1rem)]` on the page wrappers; measured 83 px for both). No logic change.
- **Pages menu moved to a left sidebar** (Notion-style) from 840 px up: logo, vertical Room / Fixture / Visualize / Statistics with icon + label, KPI pill and day/night button under it; sticky. Below 840 px it stays the top pill bar with icons only (`aside` is `display: contents` there so the bar still sticks). Checked at 1280 and 400 px.
- **Floor plan image, Phase 1**: Floor plan image panel (now on the Room page) (load PNG/JPG, opacity, Pick 2 points + printed length + Set scale, Check another, Remove). Pure maths in `src/engine/calibrate.ts` (7 tests); UI in `src/ui/planImage.ts`, three one-line hooks in legacy (`fitRoom` resizes L/W when no shape is traced; the image sits in its own card, not over the plan). Image stays in memory only. Moved out of the plan into a separate card the same day (user request). Then added **Trace room**: after Set scale, click the inside corners on the image (segments snap to horizontal / vertical, click the amber first corner or Finish room to close); the outline becomes the room and the plan, heat map and stats regenerate (`snapOrtho`, `tracedPoly` in `calibrate.ts`; `setRoom` hook in legacy). Bug fixed: `polyArea` is signed, so a clockwise trace was rejected as self-crossing. Checked in Chrome with a generated 8 x 5 m plan: scale and room box correct. Known: image not saved with a room; no rotation; scale applies per load.
- **Research: floor plan from image** (no code): see the Phase 1-3 roadmap item. Findings: DIALux and other tools import a PNG / JPG as a background and scale it from a known distance; published pipelines read dimension text with OCR and compare it with measured pixel length to get the scale; deep-learning wall segmentation (CubiCasa5K-based) is reported to generalise poorly to unseen real-world plans; opencv.js is about 8-10 MB (2.6-3.4 MB gzip) and tesseract-wasm about 2 MB, against the project's no-runtime-dependency rule. Open questions for the user: what kind of plans (CAD export screenshots, scans, phone photos), how dimensions are drawn (inside / centre / outside of walls), cloud AI acceptable or browser-only.
- **Library picker is a column view** (uncommitted): Brand | Type | Fixture columns like Finder (click a selected row again to clear it, search narrows all columns), in a full-width row on the Fixture card. Tested with the real Lucelight files (14,118 files, 61 families): opens in under a second, picking a file fills lumens / watts / names from the header. Unit test rewritten for the drill-down; 73 tests pass.
- **Plan tools are a vertical rail** (uncommitted): the layer / tool buttons moved out of their own card above the plan into a narrow static column on the left of the Floor plan card (`flex` row, top-aligned; it scrolls with the page and does not follow). Vertical from 560 px up; on phones it lies flat above the plan so the plan keeps its width. Checked at 1280 and 375 px; 73 tests pass.
- **Draw / edit room on the Visualize page** (uncommitted): icon button (`#shapeEditBtn`, `data-shape="edit"`) at the end of the plan tools row, same action as the Room page chip and kept in sync with it (pressed while editing). Starting it switches the 3D view off, since the plan is hidden there. Checked in Chrome: toggles on and off, corner handles and Done editing appear; 73 tests pass.
- **REMLUX title is one tone, smaller** (uncommitted): size now `clamp(2rem, 10vw, 3.5rem)` (was up to 6rem). removed the purple "REM" span; new `title` token (`#ece9e2` off-white at night, Latte text `#4c4f69` by day so it stays readable). Checked at night in Chrome; 73 tests pass.
- **Day / night mode** (uncommitted): square sun / moon button at the right of the nav (`#themeBtn`, `src/ui/theme.ts`). Day = Catppuccin Latte tokens, night stays Tokyo Night and is the default. Saved in `localStorage` (`remlux:theme`), applied before paint, 3D view redraws on switch. The top / bottom blur strips now use the paper token instead of a fixed dark tint. Heat maps keep their dark false-colour palette in both modes. Checked all pages in Chrome; 73 tests pass. Ideas: follow the system setting when nothing is saved; a lighter heat-map ramp for day mode; Latte-tuned group colours.
- **Visualize layout swapped** (uncommitted): wide main column (suggest, tools, floor plan, section, one downlight, wall scallops) on the left, 280 px sidebar (Groups, Grid) on the right via `md:order-*`; sidebar stays first on phones. 73 tests pass.
- **One downlight moved to Visualize; Fixture is a horizontal card** (uncommitted): the card sits between Section and Wall scallops. The Fixture page is single column: Groups, then one wide Fixture card (brand, name, light source on top; beam angle, lumens, power, radius in a row of four below, presets under them). Checked at 1280 and 400 px; 73 tests pass.
- **Icon-only page tabs and descriptions removed** (uncommitted): the four tabs show icons with `aria-label` + tooltip. Removed explanatory prose: group hints, formation / placement / spacing / suggest / plan / section / wall / surfaces notes, one-downlight captions, IES info line, fixture radius, colour-scale and dimension notes. Kept: warnings and errors, live readouts (captions with numbers, verdict, histogram line) and the Method note (it carries the direct-light and DIALux-confirmation decision from `MEMORY.md`). 73 tests pass, all four pages load without script errors.
- **Fixture library + LDT** (uncommitted): `parseLDT`/`parsePhotometry` in the engine (shared `reducePlanes` with IES, IES results unchanged), `brand` read from `[MANUFAC]`. `library/<brand>/<type>/*.ies|ldt` discovered with `import.meta.glob`; picker (search, brand chips, list) on the Fixture page fills photometry, brand, name, lumens, watts. The library folder is empty: add manufacturer files (see `library/README.md`). 73 tests pass; checked in Chrome with a temporary file. Ideas: generated index with CCT / CRI / beam shown in the list rows; check manufacturer licence terms before committing files.
- **Brand and fixture name** (uncommitted): two text fields on the Fixture page per group (`brand`, `fixname`, in `GV` so they save per group and in `dlc:last`). Used on the Stats page (result card + "Light" column in the downlight table, per scope), the spec summary, One downlight caption and group tooltip. Typing a name updates everything at once (no Update click). Checked in Edge: per-group values, reload, summary lines. Idea: fill them from the IES header (MANUFAC / LUMINAIRE) when a file is loaded.
- **Room page decluttered** (uncommitted): removed the small helper texts (shape description, wall zone / work plane note, "Saved in this browser only", corner format hint, "No saved rooms yet"). Kept warnings: crossing walls, bad corner list.
- **Colour scale on the One downlight card** (uncommitted): scale buttons (Auto, 100–2000 lx) and a bar under the top view and profile, with markers for the field (10%) and beam (50%) edge lux. Independent of the floor plan scale (`oneScale` vs `lxScale`, both saved); default Auto. Avoids the `.legend` class because the plan legend query picks the first one in the DOM. Checked in Edge: changing one scale leaves the other, survives reload.
- **3D view with orbit / pan / zoom** (uncommitted): new tool button on the floor plan card toggles a 3D render (`src/render/iso.ts`): heat map on the floor, walls, ceiling, beam cones. Free orthographic camera: four handles on the right of the view (Orbit, Pan, Zoom, Reset) plus mouse controls like Blender/Cinema 4D (left drag orbit, right/middle or Shift pan, wheel zoom, double-click reset). Checked in Edge for a rectangle, an L-shaped room and two groups. Display only; calculation untouched, 64 tests pass. Ideas for later: pinch/two-finger touch, light editing in 3D, view presets (top, front, side).
- **Floor plan tool palette** (uncommitted): the layer/tool buttons moved into their own card above the floor plan and are icon-only, 44 px (`chip tool`); the selection-bar buttons (add, remove, group spacing) are icon-only too. Names are kept as `aria-label` and tooltip.
- **Lengths in mm: tried and reverted** (not committed): all lengths were briefly shown in mm, then returned to metres at the user's request. The app shows metres everywhere again (millimetres only for downlight diameter); smoke test text is back to the original. Kept from that work: the group-box click fix.
- **Group editing on the floor plan** (uncommitted): *Move whole group* chip / Shift-drag moves all lights of the selected group; *Group spacing −/+ 10%* scales the group about its centroid, clamped to the room; draggable scale handle on the group's bounding box (checked in Edge: drag pulls lights closer); line icons on the layer chips and selection-bar buttons (`.chip .ic` in `styles.css`). Stats page: *All groups* plus one scope button per group (checked in Edge: 16 fixtures 462 lx avg vs 4 fixtures 132 lx). Engine untouched, 64 tests pass.
- **Docs split into three** (`30e33e6`): `CLAUDE.md` (working rules, architecture, conventions), new `MEMORY.md` (business logic: lighting model, room/fixture/group/layout rules, Suggest criterion, product decisions, reference numbers), `PROGRESS.md` (progress).
- **PROGRESS.md + CLAUDE.md split** (`8ac13cf`): progress tracking moved out of CLAUDE.md; CLAUDE.md now holds working rules, architecture, conventions, reference numbers and verification method.
- **Tailwind CSS v4** (`3f306b9`): stylesheet rewritten as theme tokens + base + components; `index.html` layout in utilities. Pixel-identical to the original in 14/16 screenshots.
  - Fixed: the corner-coordinates textarea overflowed its panel by 22 px (it was `content-box` inside `<details>`).
  - Fixed: the progressive blur at the screen edges had stopped working in the step 2 build (Vite's CSS minifier dropped the `backdrop-filter`); it works again.
- **Calculation engine** (`819dd96`): maths moved to `src/engine/` with 60 unit tests. Output compared field by field with the original app in 9 scenarios: identical.

### 2026-11-10
- **Project setup** (`a8c00b2`): Vite + TypeScript + Vitest, file split, smoke test, single-file build.
- **Git** (`b9c82f2`): repository created; original app committed.
- Room surfaces / reflectance and radiosity removed from the app (before git; included in the first commit).
- Node.js LTS installed; agent skills installed (emilkowalski/skills, taste-skill, impeccable, stageshow).
