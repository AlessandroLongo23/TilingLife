<script>
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import { debugStore, updateDebugStore } from '$lib/stores/debug';

	let chartElement;
	let chart;
	let currentPath = $state([]);
	let breadcrumbs = $state([]);

	// Use vivid, modern colors with good contrast
	const colorPalette = [
		'rgba(99, 102, 241, 0.8)',  // Indigo
		'rgba(239, 68, 68, 0.8)',   // Red
		'rgba(34, 197, 94, 0.8)',   // Green
		'rgba(249, 115, 22, 0.8)',  // Orange
		'rgba(16, 185, 129, 0.8)',  // Emerald
		'rgba(217, 70, 239, 0.8)',  // Fuchsia
		'rgba(14, 165, 233, 0.8)',  // Sky
		'rgba(234, 179, 8, 0.8)',   // Yellow
		'rgba(236, 72, 153, 0.8)',  // Pink
		'rgba(168, 85, 247, 0.8)'   // Purple
	];

	function formatTime(ms) {
		if (ms < 1) return '<1ms';
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function handleChartClick(event) {
		if (!chart) return;
		
		const activePoints = chart.getElementsAtEventForMode(
			event,
			'nearest',
			{ intersect: true },
			false
		);
		
		if (activePoints.length === 0) return;
		
		const clickedIndex = activePoints[0].index;
		const clickedPhase = $debugStore.timingData.phases[clickedIndex];
		
		if (clickedPhase.hasChildren) {
			const newPath = [...currentPath, clickedPhase.label];
			updateDebugStore(newPath);
		}
	}

	function navigateBack() {
		if (currentPath.length === 0) return;
		
		const newPath = currentPath.slice(0, -1);
		updateDebugStore(newPath);
	}

	function navigateTo(path) {
		updateDebugStore(path);
	}

	function createChart(data) {
		if (!chartElement || !data || data.phases.length === 0)
			return;

		if (chart)
			chart.destroy();

		const labels = data.phases.map(phase => phase.label);
		const values = data.phases.map(phase => phase.value);
		const colors = data.phases.map((phase, i) => {
			if (phase.label === 'Self time') {
				return 'rgba(100, 100, 100, 0.5)';
			}
			return colorPalette[i % colorPalette.length];
		});
			
		chart = new Chart(chartElement, {
			type: 'doughnut',
			data: {
				labels: labels,
				datasets: [{
					data: values,
					backgroundColor: colors,
					borderColor: 'rgba(30, 30, 30, 0.8)',
					borderWidth: 1,
					hoverOffset: 5,
					cutout: '60%'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: 10
				},
				onClick: handleChartClick,
				plugins: {
					legend: {
						position: 'right',
						labels: {
							color: 'rgba(255, 255, 255, 0.8)',
							font: {
								size: 10,
								family: 'system-ui, sans-serif'
							},
							boxWidth: 10,
							padding: 8,
							generateLabels: function(chart) {
								const original = Chart.overrides.doughnut.plugins.legend.labels.generateLabels;
								const labels = original.call(this, chart);
								
								return labels.map((label, i) => {
									const phase = data.phases[i];
									// Add percentage and time to label
									const percentage = phase.percentage.toFixed(1);
									const timeDisplay = formatTime(phase.value);
									let text = `${label.text}: ${timeDisplay} (${percentage}%)`;
									
									// Add indicator for drillable items
									if (phase.hasChildren) {
										text += ' →';
									}
									
									label.text = text;
									return label;
								});
							}
						}
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const phase = data.phases[context.dataIndex];
								const label = context.label || '';
								const value = formatTime(phase.value);
								const directValue = formatTime(phase.directTime);
								const percentage = phase.percentage.toFixed(1);
								
								if (phase.directTime < phase.totalTime) {
									return [
										`${label}: ${value} (${percentage}%)`,
										`Self time: ${directValue} (${(phase.directTime / data.totalTime * 100).toFixed(1)}%)`
									];
								}
									
								return `${label}: ${value} (${percentage}%)`;
							}
						}
					}
				}
			},
			plugins: [{
				id: 'centerText',
				beforeDraw: function(chart) {
					const width = chart.width;
					const height = chart.height;
					const ctx = chart.ctx;
					
					ctx.restore();
					
					// Total time in center
					const fontSize = Math.min(width, height) * 0.10;
					ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
					
					const formattedTime = formatTime(data.totalTime);
					ctx.fillText(formattedTime, width / 4 + 5, height / 2);
					
					// "Total" label below
					const smallFontSize = fontSize * 0.5;
					ctx.font = `${smallFontSize}px system-ui, sans-serif`;
					ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
					ctx.fillText('Total', width / 4 + 5, height / 2 + fontSize * 0.7);
					
					ctx.save();
				}
			}]
		});
	}
	
	// Update chart when debug data changes
	$effect(() => {
		const data = $debugStore.timingData;
		currentPath = data.currentPath || [];
		breadcrumbs = data.breadcrumbs || [];
		
		if (data && data.phases.length > 0)
			setTimeout(() => createChart(data), 0);
	});

	onMount(() => {
		const data = $debugStore.timingData;
		if (data && data.phases.length > 0) {
			createChart(data);
		}
		
		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});
</script>

<div class="chart-container w-full h-64 bg-zinc-800/60 backdrop-blur-sm rounded-lg overflow-hidden border border-zinc-700/50">
	<div class="px-4 py-2 text-xs font-medium text-white/80 flex justify-between items-center border-b border-zinc-700/50">
		<div class="flex items-center gap-2">
			{#if currentPath.length > 0}
				<button 
					class="text-white/60 hover:text-white/90 flex items-center"
					onclick={navigateBack}
				>
					<span class="text-lg leading-none mr-1">←</span>
					<span>Back</span>
				</button>
			{:else}
				<button 
					class="text-blue-300 hover:text-blue-100"
					onclick={() => navigateTo([])}
				>
					Root
				</button>
			{/if}
			
			{#if currentPath.length > 0}
				<span class="text-white/50 mx-1">›</span>
				<div class="flex items-center">
					{#each breadcrumbs as crumb, i}
						<button 
							class="text-blue-300 hover:text-blue-100"
							onclick={() => navigateTo(crumb.path)}
						>
							{crumb.label}
						</button>
						{#if i < breadcrumbs.length - 1}
							<span class="text-white/50 mx-1">›</span>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>
	
	<div class="p-2 h-[calc(100%-32px)]">
		<canvas bind:this={chartElement}></canvas>
	</div>
</div>

<style>
  .chart-container {
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }
</style> 