# TODO

## Big changes

- [x] add islamic tilings
- [ ] add rigorous tilings classification to catalogue and theory
- [ ] add procedurally generated aperiodic tilings
- [ ] add database for tilings and gol rules, with users tiling findings
- [ ] add operations (fractalization , rectification, truncation)
- [ ] generate tilings from the k-uniform-solver output instead of using the GomJau-Hogg notation

## Algorithm

- [x] expand notation to allow rotations of a certain angle around a point
- [ ] implement automatic vertices types molteplicity detection, by using rotations, simmetries and translations (and automatic R&C notation)
- [ ] implement automatic holes/overlap checks to ensure tiling validity

## Optimizations

- [x] optimize tiling generation (transform only outer layer)
- [x] optimize gol simulation (on aliveNeighbors count)

## Features

- [x] add R&C notation
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
- [x] fix polygon angles in some tilings
- [x] fix missing tiling (with overlapping between polygons)
- [ ] fix text size based on zoom
- [ ] fix sounds and vertex types graphic visualization

## Ideas

- [ ] Tower defense game
- [ ] Infinity Loop
