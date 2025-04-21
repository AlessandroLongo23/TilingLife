import { writable } from 'svelte/store';

export let golRule = writable('B3/S23/6'); // Conway's Game of Life with 6 generations
export let golRules = writable({
  3: 'B3/S23/4',  // Triangle: Conway's Game of Life with 4 generations
  4: 'B36/S23/5', // Square: HighLife with 5 generations
  6: 'B2/S34/6',  // Hexagon: Life without Death with 6 generations
  8: 'B3/S12/7',  // Octagon: Maze rule with 7 generations
  12: 'B2/S/8'    // Dodecagon: Seeds with 8 generations
});
export let tilingRule = writable('3/m30/r(h1)');
export let isDual = writable(false);
export let transformSteps = writable(0);
export let side = writable(50);
export let showConstructionPoints = writable(false);
export let showInfo = writable(false);
export let speed = writable(20);
export let ruleType = writable('Single');
export let activeTab = writable('Tilings');