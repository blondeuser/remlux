# REMLUX: Business logic

Related: [[REMLUX/CLAUDE]] · [[REMLUX/PROGRESS]] · [[_global/INDEX]]

What the app does and the domain rules behind it. **Rules for working on the code** are in `CLAUDE.md`; **project status** is in `PROGRESS.md`. Update this file when a calculation, rule, range or product decision changes.

## Product

- REMLUX calculates and visualizes how light from downlights spreads in a room, in the spirit of DIALux, but fast and simple.
- Purpose: **early lighting layout**: how many downlights, which beam, what spacing. Final results are confirmed in DIALux with the manufacturer's real IES/LDT files. The app says this in its Method note.
- Runs fully in the browser; nothing is sent anywhere. Saved rooms live in the browser only.

## Product decisions

| Decision | Status |
|---|---|
| **Direct light only.** No reflections from walls, ceiling or floor, so real rooms measure somewhat brighter. Room surfaces / reflectance and the radiosity calculation were removed on 2026-11-10 at the user's request. | Do not reintroduce unless the user asks |
| **Furniture and other objects are for show only.** They are never part of the calculation: no shadows, no illuminance on their surfaces, no obstruction of the work plane. Only the room outline and the work plane are calculated. (Decided 2026-11-11, "at this point": a later version may add object surfaces.) | Applies to anything drawn from an uploaded plan image; do not add shadow or surface calculations unless the user asks |
| **Plan image scale.** A loaded floor plan image (shown in its own card, not over the plan) is scaled from one printed dimension (metres per pixel = real length / pixel distance). Printed lengths are corrected to the inside face: centre line minus 1 x wall thickness, outside face minus 2 x. A second dimension is checked, and more than 2 % off is flagged. The image is a tracing aid only and is never saved or calculated. | Phase 1 of the image feature |
| Results must stay identical to the original single-file app unless a change is intended. | Locked by tests |
| Units: metres, lux (lx), lumens (lm), candela (cd), watts (W), millimetres only for downlight size. | |

## Room

- **Shape:** rectangle from Length × Width, a preset (L, T, U), or a custom polygon (corner coordinates, or drawn and edited on the plan). Length and Width are the overall bounding box; changing them stretches the shape.
- Preset outlines in an L × W box: **L** removes the top-right quarter (0.5 L × 0.5 W); **T** is a full-width bar 0.45 W deep plus a stem between 0.33 L and 0.67 L; **U** has a notch between 0.35 L and 0.65 L, 0.6 W deep. Corners rounded to 1 cm.
- **Height** H: floor to ceiling, where the downlights are.
- **Work plane height** wp: where lux is calculated (0 = floor, about 0.75 m = desks). Calculation height **h = H − wp**; must be > 0.
- **Wall zone** (default 0.5 m, as EN 12464-1): a strip along the walls left out of min, average and uniformity. Never more than a quarter of the room's length or width. 0 includes the whole floor.
- In a **non-convex room** (L/T/U…), walls are full height: a wall between a light and a point blocks that light completely. A line that only touches a corner is not blocked.
- Walls that cross each other are flagged ("Drag the corners to fix it").

## Fixtures (downlights)

- **Generic beam:** cosⁿ distribution, with n fitted so intensity is 50% of peak at half the beam angle. Beam angle **5–120°**. Lumens per fixture > 0. Preset angles: 10, 15, 24, 36, 45, 60, 90°.
- **LDT file** (EULUMDAT): intensities are cd per 1000 lm, scaled by total lamp flux × conversion factor; C-planes averaged like IES. Brand comes from the first line, name from the luminaire line, watts summed over lamp sets. Tilt data ignored.
- **Fixture library**: `library/<brand>/<type>/*.ies|ldt`; the first folder is the brand, the second the type / product family (downlights, track lights, RIO SUB…; files directly in the brand folder are "Other", deeper folders are flattened). The picker shows them as Finder-style columns. Picking one behaves exactly like loading the file by hand and fills brand and fixture name from the file header.
- **IES file** (LM-63, Type C only): the C-planes are averaged (trapezoid weights) into one rotationally symmetric curve. Multiplier × ballast factor applied. Flux is integrated from the curve; upward share (γ > 90°) is reported. When IES is active, beam angle, lumens and watts come from the file (inputs locked). Type A/B files, missing `TILT=`, truncated data and files with no downward light are rejected with a readable message.
- **Beam edge** = 50% of peak intensity; **field edge** = 10%. Spread on the plane: beam Ø = 2·h·tan(beam half-angle), field Ø = 2·h·tan(field half-angle, capped at 85°).
- **Power** per fixture is optional; used for total W, W/m² and lm/W.
- **Downlight radius** (mm) only affects drawing to scale.
- Light loss factor is currently 1.

## Lighting groups

- A room has one or more groups; each has its own fixture, formation, spacing and placement. Every group that is **On** adds to the result; Off groups are drawn dashed and ignored.
- The selected group is edited with the on-screen inputs; the others keep their stored settings.
- "Add group" starts from the current fixture with a 2 × 2 grid over the whole room; "Duplicate" copies the selected group.

## Layout (formations)

- **Grid:** nx × ny, half a spacing to the walls (spacing = L/nx, W/ny).
- **Staggered:** like brickwork; odd rows offset by half a spacing with one light fewer.
- **Honeycomb (hex):** every light equidistant from its six neighbours; row spacing = spacing × √3/2.
- **Perimeter:** only the outer ring of the grid. In a shaped room it follows the walls, inset by half a spacing.
- **Spacing modes:** *Even in room* (spread nx × ny evenly), *Set distance* (fixed centre-to-centre dx, dy; grid centred), *Custom* (drag lights freely; moving a light switches to Custom).
- **Moving a whole group:** the *Move whole group* chip (or Shift while dragging a light) moves every light of the selected group together, clamped to the room bounds, with the 0.1 m snap applied to the shift. It switches the group to Custom.
- **Group spacing ±10% / scale handle:** the square handle on the plan (bottom-right corner of the group's dashed bounding box) scales by dragging; the selection bar has ±10% buttons. Both scale the selected group's light positions about their centroid (pattern shape kept, distances change). The factor is reduced so no light leaves the room. Switches the group to Custom.
- **Statistics scope:** with two or more groups the Stats page has an *All groups* button (groups that are On, the default) plus one button per group, created automatically as groups are added or removed. A group view recomputes results, work plane table, histogram and the downlight table from that group alone, even if it is Off. The Visualize map and the spec summary always show all groups.
- **3D view:** the *3D view* tool shows the room as a box (floor heat map, translucent walls, dashed ceiling, downlights on the ceiling with beam cones and 50% beam circles on the floor). It opens as a true isometric view and can be moved freely: **orbit** (left drag, or the Orbit handle), **pan** (right/middle drag, Shift + drag, or the Pan handle), **zoom** (wheel, Ctrl + drag, or the Zoom handle), **reset** (double-click or the Reset handle). Elevation is limited to 4°–90° (never below the floor). **Render view (three.js, optional):** a cube button in each 3D viewport (room 3D view, Wall in 3D) draws the same scene with three.js on the GPU (antialiased, depth-correct transparency, real beam cones; the wall's beam cone is clipped by the wall). Same camera, same numbers, same dragging; unlit: it shows the calculated light and adds no lighting or shadows of its own. Off by default; the choice is remembered per viewport; if WebGL is unavailable the view stays on the standard drawing and says so. Display only: no numbers change, and lights are not editable in 3D (switch back to the plan). Works for shaped rooms and multiple groups (group colours, Off groups faded). Changing the room size re-fits the view but keeps the angle.
- **One downlight colour scale:** the top view of one fixture has its own scale buttons (Auto, 100 … 2000 lx) and bar, **separate from the floor plan scale** (changing one never changes the other). Defaults to Auto (stretched to that fixture's centre lux). Same colours as the plan; markers show the 50% and 10% edge lux. Saved with the state as `oneScale`.
- **Fixture brand and name:** each group has optional free-text *Brand* and *Fixture name* (Fixture page). They are labels only, no effect on the calculation. Shown on the Stats page (a "fixture" result card, and a Light column in the downlight table when any name is set; follows the All groups / single group scope), in the spec summary (`Fixture: Brand Name`, and per group when there are several), in the One downlight caption, and as a tooltip on the group row. A new group starts as a copy of the selected one, so it inherits the names until edited. Saved with the group.
- **Placement:** whole room, or *Part of the room*: a rectangle (x, y, width, depth from the top-left corner), e.g. over a table.
- In a shaped room, lights outside the outline or within 0.1 m of a wall are dropped.
- Grid size 1–20 per direction.

## Calculations

- **Illuminance** at a point: sum over all lights of E = I(γ) · cos³γ / h² (inverse square law with cosine of incidence).
- **Work plane** sampled on a grid of up to 160 cells along the longer side. Stats over cells clear of the wall zone:
  - **Ē** average, **Emin**, **Emax**; **U₀ = Emin / Ē** (EN 12464-1 uniformity); **Ud = Emin / Emax**.
- **Verdict:** beams "touch" when spacing ≤ beam Ø (else "visible pools of light"). Uniformity ≥ 0.7 "fairly even", ≥ 0.5 "moderately uneven", below "patchy".
- **Lux distribution:** histogram of the work plane (12 bands) with the Suggest target marked; reports the share of the plane reaching the target.
- **One downlight** views: top-view spread and the lux profile across the beam, with 50% / 10% edges.
- **Section** along the length: beams to scale, spacing and wall distances dimensioned.
- **Wall scallops:** a row of 1–10 lights at a set distance from a wall and spacing; vertical lux on the wall (direct only); reports scallop top (50% and 10% edges below the ceiling), scallop width halfway down, the depth where neighbouring scallops merge, and peak lux.

## Spot on wall (standalone page)

- **Not linked** to the room, the groups or the Stats page: its own wall, its own single spotlight, saved separately (`localStorage` key `remlux:spot`, including a loaded IES/LDT curve).
- **Coordinates:** wall width × height; x along the wall from its left edge, z height above the floor, y distance out from the wall (must be > 0). The spot is **aimed at a point on the wall** (x, z); tilt and incidence are derived, not typed.
- **Fixture:** generic cosⁿ beam (beam angle 5–120°, lumens) or an IES/LDT file (beam and lumens then come from the file and are locked), the same model as the downlights, rotated so γ is measured from the aim axis. Power (W) is only for lm/W. **Spot size Ø (mm) is drawing only.** Colour temperature (K) only tints the "Lighting effect" render; it never changes lux.
- **Lux:** E = I(γ) · cos(incidence) / d², direct only; zero when γ ≥ 90° (behind the spot) or the light reaches the wall from behind. Aimed straight down at a floor this equals the downlight formula (locked by a test).
- **Outputs:** lux at the aim point (hero), peak on the wall, average inside the beam, beam (50%) and field (10%) footprint width × height (cells whose off-axis angle is inside the half-angle), throw, tilt from straight down, centre beam intensity (cd), lm/W, angle between beam and wall normal, wall average.
- **Views:** a **3D view** (free orthographic camera like the room's 3D view: orbit, pan, zoom, home = front-left, slightly above; refits when the wall size changes) showing the wall with *Lighting effect* (warm-white wall, tone-mapped lux 1 − e^(−E/k) with k = 0.55 × exposure, tinted by CCT) or *Lux map* (same false colours as the plan); scale / exposure Auto (= peak) or 100…2000 lx. Beam and field outlines are the exact cone-wall intersections. Side view = the plane through the spot square to the wall (an aim offset along the wall is projected). In 3D the wall, a floor strip with a 0.5 m grid, the spot body (to scale, along the beam axis), the beam cone, drop lines spot → floor → wall base. Drag the aim cross (moves on the wall) or the spot (moves in its own plane parallel to the wall, y unchanged) in 3D, Shift + drag the spot (or the ring on the floor under it) to change x and y at the same height, or the spot in the side view for y and z (0.05 m snap); **Reset transform** restores position and aim only; dragging anywhere else orbits. Hover reads the lux on the wall. **Reset to defaults** restores every input, the generic beam, the view and the camera and clears `remlux:spot`.

## Suggest a grid for a target

- Input: target average lux (rough targets: corridors 100 lx, living rooms 150–200 lx, offices 300–500 lx).
- Tries every formation size up to **12 × 12** whose cells are roughly square (cell aspect 0.6–1.67; perimeter needs ≥ 2 × 2), **fewest fixtures first**, on a coarse 24 × 24 sample.
- Returns the first that reaches the target average **and U₀ ≥ 0.5**; otherwise says none works and suggests more lumens or a wider beam.
- Uses the selected group's fixture and formation on its own.

## Display

- Colour scale for the plan heatmap: Auto (stretched to the brightest point) or fixed 100 / 200 / 500 / 1000 / 2000 lx (default 500; brighter areas clip). Same scale is used by the one-downlight view and the histogram.
- Plan layers: lux map, beam edge (50%), field edge (10%), dimensions, move lights, snap to 0.1 m.

## Reference numbers (default room)

6 × 4.5 × 2.8 m, work plane 0 m, wall zone 0.5 m, 4 × 3 grid, 800 lm, 36°, 10 W:
- **330 lx average, Emin 244, Emax 378, U₀ 0.74**
- 241 lx directly under one fixture alone; beam Ø 1.82 m, field Ø 3.52 m
- Wall scallops (0.3 m from wall, 1.2 m apart, 5 lights): peak 405 lx
- Suggest for 300 lx → 4 × 3 grid, ≈ 332 lx
- 120 W total, 4.4 W/m², 80 lm/W

## Saved data

- The last state is restored when the page opens; rooms can be saved by name. **Old saves must always keep loading** (storage is being versioned in step 4; see `PROGRESS.md`).
