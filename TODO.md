# TODO

## Big changes

- [ ] generate tilings from the k-uniform-solver output instead of using the GomJau-Hogg notation
- [ ] add different types of tilings (aperiodic, etc.)

## Algorithm

- [ ] Figure out a way to detect the vertices types molteplicity automatically

## Optimizations

- [x] optimize tiling generation (transform only outer layer)
- [x] optimize gol simulation (on aliveNeighbors count)

## Features

- [x] add R&C notation to all tilings and fix visualization
- [x] add R&C filtering and sorting in the catalogue
- [ ] add zoom and movement with the mouse instead of the slider
- [ ] add R&C for face types (dual polygons)
- [ ] add predefined palettes in the colorPad
- [ ] add more trasnformations and visualizations (truncation, fractalization, circle packing)

## UI

- [ ] remove unnecessary buttons and checkboxes (or move them to dev visualization)

## Bugs

- [x] fix adjustable angle tilings
- [ ] fix polygon angles in some tilings
- [ ] add missing R&C notations and fix checks on same vertices
- [ ] fix screenshot delay