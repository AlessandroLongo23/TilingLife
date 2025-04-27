import { writable } from 'svelte/store';

export let golRule = writable('B3/S23'); // Conway's Game of Life with 6 generations
export let golRules = writable({});
export let selectedTiling = writable({
	name: 'square',
	rulestring: '4/m45/r(h1)',
	cr: '4^4',
	dualname: 'square'
});
export let isDual = writable(false);
export let transformSteps = writable(0);
export let side = writable(50);
export let showConstructionPoints = writable(false);
export let showInfo = writable(false);
export let speed = writable(20);
export let parameter = writable(45);
export let ruleType = writable('Single');
export let activeTab = writable('Tilings');
export let showCR = writable(false);
export let debugView = writable(false);
export let screenshotButtonHover = writable(false);
// export let screenshotSize = writable(600);

export let tolerance = 0.01;
export let possibleAngles = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export let possibleSides = [0, 3, 4, 5, 6, 8, 9, 12, 18];

export const offsets = [
	[-1, -1], [-1, 0], [-1, 1],
	[0, -1],  [0, 0],  [0, 1],
	[1, -1],  [1, 0],  [1, 1]
];

export const patch = {
	size: {
		x: 200,
		y: 200
	},
	padding: 15,
	borderRadius: 12
};