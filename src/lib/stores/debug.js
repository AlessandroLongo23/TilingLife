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
		// End any pending timers to prevent leaks
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
		
		// Ensure duration is positive
		if (duration < 0) {
			console.warn(`Timer "${label}" has negative duration: ${duration}ms. Skipping.`);
			return;
		}
		
		// Get the node for this timer and update its direct time
		const node = this.getNode(path);
		node.time += duration;
		
		// Recalculate total time for this node and all parent nodes
		this.recalculateTotalTimes();
		
		// Update the current path
		while (this.currentPath.length > 0 && this.currentPath[this.currentPath.length - 1] !== label) {
			this.currentPath.pop();
		}
		if (this.currentPath.length > 0) {
			this.currentPath.pop();
		}
		
		this.pendingTimers.delete(label);
		delete this.startTimes[label];
	}

	// Fix for more accurate time calculations
	recalculateTotalTimes() {
		const calculateNodeTotalTime = (node) => {
			let childrenTime = 0;
			
			// Calculate total time of all children
			Object.values(node.children).forEach(child => {
				// Recursively calculate child total time
				calculateNodeTotalTime(child);
				// Add to children time sum
				childrenTime += child.totalTime;
			});
			
			// Total time = direct time + children time
			node.totalTime = node.time + childrenTime;
		};
		
		// Start calculation from root
		calculateNodeTotalTime(this.timingTree);
	}

	getTimingData(path = []) {
		const node = this.getNode(path);
		
		// Direct time spent in this operation (excluding children)
		const directTime = node.time;
		
		// Total time including children
		const totalTime = node.totalTime;
		
		// Calculate self time (time not attributed to children)
		const selfTime = directTime;
		
		// Get children data
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
		
		// Add self time if it exists
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
		
		// Create breadcrumbs for navigation
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

// Updates the store when timing data changes
export function updateDebugStore(path = []) {
	const data = debugManager.getTimingData(path);
	
	debugStore.set({
		isEnabled: debugManager.isEnabled,
		timingData: data
	});
} 