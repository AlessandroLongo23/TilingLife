import { writable } from 'svelte/store';
import { GOLRuleType, Vector } from '$classes';

export enum ActiveTab {
	TILINGS = 'Tilings',
	GAME_OF_LIFE = 'Game of Life',
	THEORY = 'Theory'
} 

export let golRule = writable('B3/S23');
export let golRules = writable({});
export let selectedTiling = writable({
	name: 'square',
	rulestring: '4-4-0,4/r90/r(v2)',
	cr: '4^4',
	dualname: 'square',
	golRules: {
		standard: [],
		dual: []
	}
});
export let isDual = writable(false);
export let transformSteps = writable<number>(5);
export let controls = writable({
	zoom: 50,
	targetZoom: 50,
	offset: new Vector(0, 0),
	targetOffset: new Vector(0, 0),
	dampening: 0.2
});
export let speed = writable<number>(20);
export let parameter = writable<number>(45);
export let lineWidth = writable<number>(1);
export let showDualConnections = writable<boolean>(false);
export let ruleType = writable<GOLRuleType>(GOLRuleType.SINGLE);
export let activeTab = writable<ActiveTab>(ActiveTab.TILINGS);
export let debugView = writable<boolean>(false);

export let showPolygonPoints = writable(false);
export let showConstructionPoints = writable(false);
export let showWallpaperGroup = writable(false);
export let showChart = writable(false);
export let liveChartMode = writable('count');

export let screenshotButtonHover = writable(false);
export let takeScreenshot = writable(false);
export let exportGraphButtonHover = writable(false);
export let exportGraph = writable(false);

export const colorParams = writable({ a: 180, b: 0 });
export let possibleAngles = [15, 20, 30, 36, 40, 45, 48, 60, 72, 75, 90, 120, 135, 144, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export let possibleSides = [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30, 36, 40, 48, 60, 72, 90, 120, 144, 180, 240, 360];

export let isIslamic = writable(false);
export let islamicAngle = writable(90);

export let circlePacking = writable(false);
export let isTilingRegularOnly = writable(false);

export const patch = {
	size: {
		x: 200,
		y: 200
	},
	padding: 15,
	borderRadius: 12
};