# REMLUX

## Room

Shape

Length

m

Width

m

Height

m

Corner coordinates

One corner per line: x, y in metres, going round the room.

Work plane height

m

Wall zone excluded

m

## Saved rooms

Room name

## Groups

each with its own fixture and layout

## Fixture

Brand, Fixture name (optional labels, shown on the Statistics page and in the spec summary).

Light distribution

Beam angle

°

Lumens per fixture

lm

Power per fixture (optional)

W

Downlight radius

mm

## One downlight

Colour scale buttons and bar under the charts (0 lx to the top of the scale, with markers for the beam and field edge). Separate from the floor plan colour scale.

## Groups

each with its own fixture and layout

## Grid

Formation

Placement

x

y

width

depth

Lights are laid out inside this rectangle, measured in metres from the top-left corner of the plan. Good for a group over a table, island or corridor.

Columns · length

Rows · width

Distance between downlights

Along length

m

Along width

m

Centre to centre. A set distance centres the grid in the room.

## Suggest a grid for a target

lx avg

Uses the formation selected on the left. Finds the fewest fixtures that reach your target with a uniformity of at least 0.5. Rough targets: corridors 100 lx, living rooms 150–200 lx, offices 300–500 lx.

## Floor plan

Tools card (icon buttons, hover for the name): Lux map, Beam edge (50%), Field edge (10%), Dimensions, Move lights, Move whole group, Snap 0.1 m, 3D view. In 3D, use the handles on the right (Orbit, Pan, Zoom, Reset) or the mouse: left drag orbits, right drag or Shift + drag pans, the wheel zooms, double-click resets.

0 lx

Tap or drag a light on the plan to move it. Moving a light switches the layout to Custom.

Move whole group: drag any light to move every light of the selected group (or hold Shift while dragging). Drag the square handle at the corner of the dashed box around the group to scale it, bringing the lights closer together or further apart. The Group spacing buttons (− 10% / + 10%) do the same in steps.

## Section along the length

## Wall scallops

Light to wall

m

Spacing along wall

m

Lights

Elevation of the wall, ceiling at the top. Light fills the area under each arch. Solid line: 50% edge. Dashed line: 10% edge.

dim

## Surfaces

Ē average, Emin lowest, Emax highest, U₀ = Emin ÷ Ē (EN 12464-1 uniformity), Ud = Emin ÷ Emax. Work plane values leave out the wall zone.

## Lux distribution

## Each downlight

Statistics for: All groups, or one button per group. A group button shows the results, work plane table, histogram and downlight list for that group alone.

## Spec summary

## Method

Model: either a loaded IES file (C-planes averaged into one rotationally symmetric curve) or a generic cosn distribution fitted so intensity falls to 50% at half the beam angle. Direct light only: no reflections from walls, ceiling or floor, so real rooms will measure somewhat brighter. Use for early layout, then confirm with the real IES or LDT file in DIALux.
## Spot on wall

A standalone page: one spotlight in front of a wall, not linked to the room or the groups.

- **Spotlight:** Generic beam or Load IES / LDT; Beam angle (°), Lumens (lm), Power (W), Spot size Ø (mm, drawing only), Colour temperature (K, look only). Presets 8–60°.
- **Position (m):** Along x, Out y, Height z. Aim point on the wall: Along x, Height z. *Aim square on*, *Centre*, *Reset transform* (position and aim back to defaults).
- **Results:** lux at the aim point, peak on the wall, average inside the beam, beam (50%) and field (10%) w × h, throw and tilt from down, centre beam cd, lm/W, beam to wall normal.
- **Wall in 3D:** *Lighting effect* (how the lit wall looks) or *Lux map*; Exposure / Colour scale Auto or 100–2000 lx. Orbit, Pan, Zoom, Reset view, *three.js render view* (draw the wall with the GPU instead of the standard view; same camera and numbers). Drag the scene to orbit (Shift or right-drag to pan, wheel to zoom). Drag the amber cross to aim, drag the spot to move it along the wall and up or down, Shift + drag it (or drag the ring on the floor under it) to move it out from the wall.
- **Wall:** Width, Height. *Reset to defaults*.
- **Side view:** the spot, its beam (50%) and field (10%) edges, the wall and floor; drag the spot out from the wall or up and down.

Direct light only: E = I · cos(incidence) / d².
