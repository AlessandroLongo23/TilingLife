# TilingLife

Conway's Game of Life on non-square tilings — an interactive catalogue of periodic tilings with a cellular-automata simulator running on top of them.

Built as a course project at DTU (Technical University of Denmark).

## What's inside

- **Tiling generator.** A string-based DSL (the GomJau–Hogg notation, extended with translations) that encodes a seed shape and a sequence of mirrors, rotations, and translations to construct any $k$-uniform periodic tiling of the plane. The catalogue covers all $k$-uniform tilings up to $k=3$, plus many at $k=4, 5, 6$.
- **Game of Life simulator.** Classic B3/S23 plus the *Generations* and *Larger-than-Life* extensions, running on arbitrary tilings via a graph-based neighborhood model — each tile is a node, neighborhoods are walked by DFS so the rules work on non-square and even irregular tilings.
- **Rule exploration.** Density / statistical-complexity metrics (following Peña et al., *Life Worth Mentioning*) used to hunt for "interesting" rules on non-square neighborhoods, with the heavy simulations parallelized on GPU using Taichi.
- **Generative soundtrack.** Four 1D Game-of-Life instances in TouchDesigner drive MIDI tracks in Ableton Live; additional UI sounds tie the interaction to the generative layer.
- **Theory pages.** Built-in write-ups on vertex configurations, the 15 valid vertex types, wallpaper groups, and the generation and simulation algorithms.

## Tech stack

SvelteKit · TypeScript · Tailwind CSS · Supabase · Vercel.

## Development

```bash
npm install
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview production build
```

## Team

| Alberto Basaglia | Alessandro Longo | Andras Egressy |
| :--- | :--- | :--- |
| parallel simulator, tiling import, metric plots | tiling-generation algorithm, web app, in-app Game of Life simulator | 1D cellular automata in TouchDesigner, soundtrack production |
