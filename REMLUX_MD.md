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

Strip along the walls left out of min and average (EN 12464-1 uses 0.5 m). 0 includes the whole floor. Work plane: 0 for floor, about 0.75 for desks.

## Saved rooms

Room name

Saved in this browser only.

## Groups

each with its own fixture and layout

## Fixture

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

0 lx

Tap or drag a light on the plan to move it. Moving a light switches the layout to Custom.

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

## Spec summary

## Method

Model: either a loaded IES file (C-planes averaged into one rotationally symmetric curve) or a generic cosn distribution fitted so intensity falls to 50% at half the beam angle. Direct light only: no reflections from walls, ceiling or floor, so real rooms will measure somewhat brighter. Use for early layout, then confirm with the real IES or LDT file in DIALux.