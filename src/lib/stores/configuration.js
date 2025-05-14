import { writable } from 'svelte/store';
import { Vector } from '$lib/classes/Vector.svelte';

export let golRule = writable('B3/S23'); // Conway's Game of Life with 6 generations
export let golRules = writable({});
export let selectedTiling = writable({
	name: 'square',
	rulestring: '4-4-0,4/r90/m(v2)',
	cr: '4^4',
	dualname: 'square',
	golRules: {
		standard: [],
		dual: []
	}
});
export let isDual = writable(false);
export let transformSteps = writable(5);
export let controls = writable({
	zoom: 50,
	targetZoom: 50,
	offset: new Vector(0, 0),
	targetOffset: new Vector(0, 0),
	dampening: 0.2
});
export let speed = writable(20);
export let parameter = writable(45);
export let lineWidth = writable(1);
export let showDualConnections = writable(false);
export let ruleType = writable('Single');
export let activeTab = writable('Tilings');
export let debugView = writable(false);

export let showPolygonPoints = writable(false);
export let showConstructionPoints = writable(false);
export let showChart = writable(false);
export let showCR = writable(false);
export let liveChartMode = writable('count');

export let screenshotButtonHover = writable(false);
export let takeScreenshot = writable(false);
export let exportGraphButtonHover = writable(false);
export let exportGraph = writable(false);

export const tolerance = 0.01;
export const colorParams = writable({ a: 180, b: 0 });
export let possibleAngles = [15, 20, 30, 40, 45, 60, 75, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export let possibleSides = [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18];

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