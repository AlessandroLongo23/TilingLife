# TODO

## Big changes

- [ ] generate tilings from the k-uniform-solver output instead of using the GomJau-Hogg notation
- [ ] add fractalization operation
- [ ] add rectification operation
- [ ] add truncation operation
- [ ] add islamic tilings
- [ ] add aperiodic tilings
- [ ] add procedurally generated aperiodic tilings

## Algorithm

- [x] expand notation to allow rotations of a certain angle around a point
- [ ] Figure out a way to detect the vertices types molteplicity automatically

## Optimizations

- [x] optimize tiling generation (transform only outer layer)
- [x] optimize gol simulation (on aliveNeighbors count)

## Features

- [x] add R&C notation to all tilings and fix visualization
- [x] add R&C filtering and sorting in the catalogue
- [x] add zoom and movement with the mouse instead of the slider
- [ ] add R&C for face types (dual polygons)
- [ ] add predefined palettes in the colorPad
- [ ] add circle packing visualization
- [ ] move gol simulation controls to the bottom in a video style (pause, play, speed)
- [ ] expand the gol catalogue with dynamic content based on tiling and rule (show oscillators, still life, etc.)
- [ ] buttons for random tiling and rule selection

## UI

- [x] remove unnecessary buttons and checkboxes (or move them to dev visualization)
- [ ] add a visualization for the construction steps
- [ ] add constructing animations

## Bugs

- [x] fix adjustable angle tilings
- [x] fix screenshot delay
- [ ] fix polygon angles in some tilings
- [ ] fix missing tiling (with overlapping between polygons)
- [ ] add missing R&C notations and fix checks on same vertices
- [ ] fix text size based on zoom

## Ideas

- [ ] Tower defense game
- [ ] Infinity Loop
