import { writable } from 'svelte/store';

class DebugManager {
	constructor() {
		this.timingTree = {
			label: 'root',
			children: {},
			time: 0,
			totalTime: 0,
			isRoot: true
		};
		this.currentPath = [];
		this.startTimes = {};
		this.isEnabled = false;
		this.pendingTimers = new Set(); // Track active timers
	}

	enable() {
		this.isEnabled = true;
		this.reset();
	}

	disable() {
		this.isEnabled = false;
	}

	reset() {
		this.pendingTimers.forEach(label => {
			if (this.startTimes[label]) {
				console.warn(`Timer "${label}" was not properly ended before reset. Cleaning up.`);
				delete this.startTimes[label];
			}
		});
		
		this.pendingTimers.clear();
		this.timingTree = {
			label: 'root',
			children: {},
			time: 0,
			totalTime: 0,
			isRoot: true
		};
		this.currentPath = [];
		this.startTimes = {};
	}

	getNode(path = []) {
		let node = this.timingTree;
		for (const label of path) {
			if (!node.children[label]) {
				node.children[label] = {
					label,
					children: {},
					time: 0,
					totalTime: 0,
					parentPath: [...path.slice(0, path.indexOf(label))]
				};
			}
			node = node.children[label];
		}
		return node;
	}

	startTimer(label) {
		if (!this.isEnabled) return;
		
		if (this.pendingTimers.has(label)) {
			console.warn(`Timer "${label}" already started. This could lead to inaccurate timing.`);
			return;
		}
		
		const timerPath = [...this.currentPath, label];
		this.startTimes[label] = {
			startTime: performance.now(),
			path: timerPath
		};
		
		this.pendingTimers.add(label);
		this.currentPath.push(label);
	}

	endTimer(label) {
		if (!this.isEnabled) return;
		
		if (!this.startTimes[label]) {
			console.warn(`Tried to end timer "${label}" but it was never started.`);
			return;
		}
		
		const endTime = performance.now();
		const { startTime, path } = this.startTimes[label];
		const duration = endTime - startTime;
		
		if (duration < 0) {
			console.warn(`Timer "${label}" has negative duration: ${duration}ms. Skipping.`);
			return;
		}
		
		const node = this.getNode(path);
		node.time += duration;
		
		this.recalculateTotalTimes();
		
		while (this.currentPath.length > 0 && this.currentPath[this.currentPath.length - 1] !== label) {
			this.currentPath.pop();
		}
		if (this.currentPath.length > 0) {
			this.currentPath.pop();
		}
		
		this.pendingTimers.delete(label);
		delete this.startTimes[label];
	}

	recalculateTotalTimes() {
		const calculateNodeTotalTime = (node) => {
			let childrenTime = 0;
			
			Object.values(node.children).forEach(child => {
				calculateNodeTotalTime(child);
				childrenTime += child.totalTime;
			});
			
			node.totalTime = node.time + childrenTime;
		};
		
		calculateNodeTotalTime(this.timingTree);
	}

	getTimingData(path = []) {
		const node = this.getNode(path);
		
		const directTime = node.time;
		const totalTime = node.totalTime;
		const selfTime = directTime;

		const childrenData = Object.values(node.children)
			.map(child => ({
				label: child.label,
				value: child.totalTime,
				directTime: child.time,
				totalTime: child.totalTime,
				percentage: totalTime > 0 ? (child.totalTime / totalTime * 100) : 0,
				hasChildren: Object.keys(child.children).length > 0
			}))
			.sort((a, b) => b.value - a.value);
		
		if (selfTime > 0) {
			childrenData.unshift({
				label: 'Self time',
				value: selfTime,
				directTime: selfTime,
				totalTime: selfTime,
				percentage: totalTime > 0 ? (selfTime / totalTime * 100) : 0,
				hasChildren: false
			});
		}
		
		const breadcrumbs = path.map((label, index) => ({
			label,
			path: path.slice(0, index + 1)
		}));
		
		return {
			currentPath: path,
			breadcrumbs,
			phases: childrenData,
			totalTime: totalTime
		};
	}
}

export const debugManager = new DebugManager();
export const debugStore = writable({ 
	isEnabled: false,
	timingData: { phases: [], totalTime: 0, currentPath: [], breadcrumbs: [] }
});

export function updateDebugStore(path = []) {
	const data = debugManager.getTimingData(path);
	
	debugStore.set({
		isEnabled: debugManager.isEnabled,
		timingData: data
	});
} 