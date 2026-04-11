# Thesis

## Steps
1. [x] generate polygons
2. [x] compute vertex configuration
3. [x] create compatibility graph
  - [ ] add self connections (if compatible)
4. [x] extract all seed sets
5. [x] build the seeds
  - [x] while bfs-ing and at the end, check the open vertices, if one vertex can't fit any vcs, kill the branch
6. [ ] expand the seeds
  - [ ] use orbit WFC to expand the seed
  - [-] compute transformations on original seed
  - [-] cycle through 3-tuples and expand even more
7. [ ] perform final checks
  - [x] add basic automatic vc detection
  - [ ] add automatic vc molteplicity detection, by using rotations, simmetries and translations 
  - [ ] add automatic holes/overlap checks to ensure tiling validity

## Content
- [ ] algorithm description and explanation
- [ ] run algorithm steps directly from interface
- [-] global navigation
- [x] angles visualization on polygons in the polygon collections (with toggle)

## Filters
- [ ] add "exact" and "include" to categories
- [ ] improve text input to support logic operators
- [ ] in tilings page, add toggle to show wallpaper group's fundamental domain and cell structure
- [x] add range slider input for number of polygons filter in vertex configuration catalogue
- [x] add toggle for displaying names in graph visualization
- [x] add sorting by n, category, or internal_angle

## QOL
- [ ] implement logger to keep track of functions execution times and memory consumption 
- [ ] move sound toggle
- [x] improve graph nodes render quality
- [x] add simulation settings to compatibility graph
- [x] add screenshot functionality to each card (polygons, vcs, seeds, tilings)

## Code and Aspect
- [ ] add classes and methods descriptions (and some comments here and there for context)
- [ ] centralize filters in store
- [ ] add light/dark mode
- [ ] create a design system and review the components

## Bugs
- [x] align all logic to counter-clockwise direction

- - -

# PROJECT

## Big changes

- [-] add islamic tilings
- [ ] add rigorous tilings classification to catalogue and theory
- [ ] add procedurally generated aperiodic tilings
- [x] add database for tilings
  - [ ] gol rules
  - [ ] users tiling findings
- [ ] add operations (fractalization , rectification, truncation)
- [x] expand notation to allow rotations of a certain angle around a point

## Features

- [x] add R&C notation
- [x] add R&C filtering and sorting in the catalogue
- [x] add zoom and movement with the mouse instead of the slider
- [x] add R&C for face types (dual polygons)
- [ ] add predefined palettes in the colorPad
- [x] add circle packing visualization
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
