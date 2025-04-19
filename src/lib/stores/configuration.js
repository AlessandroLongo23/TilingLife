import { writable } from 'svelte/store';

export let golRule = writable('B3/S23');
export let golRules = writable({
  3: 'B3/S23',
  4: 'B3/S23',
  6: 'B3/S23',
  8: 'B3/S23',
  12: 'B3/S23'
});
export let tilingRule = writable('3/m30/r(h1)');
export let transformSteps = writable(0);
export let side = writable(50);
export let showConstructionPoints = writable(false);
export let showInfo = writable(false);
export let speed = writable(20);
export let ruleType = writable('Single');
export let activeTab = writable('Tilings');