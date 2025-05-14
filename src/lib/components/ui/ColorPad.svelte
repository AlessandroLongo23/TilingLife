<script>
	import { colorParams } from '$lib/stores/configuration.js';
	import { onMount } from 'svelte';

	const MIN_A = 1;
	const MAX_A = 360;
	const MIN_B = -180;
	const MAX_B = 180;

	let padWidth = $state(120);
	let padHeight = $state(120);
	let isDragging = $state(false);
	let position = $state({ x: 180, y: 0 });
	let pad;

	$effect(() => {
		position.x = mapValue($colorParams.a, MIN_A, MAX_A, 0, padWidth);
		position.y = mapValue($colorParams.b, MAX_B, MIN_B, 0, padHeight);
	});

	function updateColorParams() {
		const a = mapValue(position.x, 0, padWidth, MIN_A, MAX_A);
		const b = mapValue(position.y, 0, padHeight, MAX_B, MIN_B);
		colorParams.set({ a: Math.round(a), b: Math.round(b) });
	}

	function mapValue(value, inMin, inMax, outMin, outMax) {
		return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
	}

	function startDrag(event) {
		isDragging = true;
		updatePosition(event);
	}

	function stopDrag() {
		isDragging = false;
	}

	function updatePosition(event) {
		if (!isDragging || !pad) return;
		
		const rect = pad.getBoundingClientRect();
		let clientX, clientY;
		
		if (event.type.startsWith('touch')) {
			clientX = event.touches[0].clientX;
			clientY = event.touches[0].clientY;
		} else {
			clientX = event.clientX;
			clientY = event.clientY;
		}
		
		position.x = Math.max(0, Math.min(padWidth, clientX - rect.left));
		position.y = Math.max(0, Math.min(padHeight, clientY - rect.top));
		
		updateColorParams();
	}

	onMount(() => {
		window.addEventListener('mousemove', updatePosition);
		window.addEventListener('mouseup', stopDrag);
		window.addEventListener('touchmove', updatePosition);
		window.addEventListener('touchend', stopDrag);
		
		return () => {
			window.removeEventListener('mousemove', updatePosition);
			window.removeEventListener('mouseup', stopDrag);
			window.removeEventListener('touchmove', updatePosition);
			window.removeEventListener('touchend', stopDrag);
		};
	});
</script>

<div class="color-pad-container">
	<div class="color-pad-header">
		<span class="color-pad-title">Color Palette</span>
	</div>
	
	<div class="color-pad-content">
		<div 
			class="color-pad" 
			bind:this={pad}
			style="width: {padWidth}px; height: {padHeight}px;"
			onmousedown={startDrag}
			ontouchstart={startDrag}
		>
			<div class="grid-lines"></div>
			<div 
				class="color-handle" 
				style="left: {position.x}px; top: {position.y}px;"
			></div>
		</div>
	</div>
</div>

<style>
	.color-pad-container {
		background-color: rgba(30, 30, 30, 0.8);
		border-radius: 8px;
		z-index: 1000;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		user-select: none;
		touch-action: none;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		overflow: hidden;
		min-width: 120px;
	}
	
	.color-pad-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		cursor: pointer;
		background-color: rgba(40, 40, 40, 0.9);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.color-pad-title {
		color: white;
		font-size: 14px;
		font-weight: 500;
	}
	
	.color-pad-content {
		padding: 12px;
	}
	
	.color-pad {
		position: relative;
		background-color: rgba(60, 60, 60, 0.3);
		border: 1px solid #555;
		border-radius: 4px;
		cursor: pointer;
		overflow: hidden;
		margin: 0 auto;
	}
	
	.grid-lines {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: 
		linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
		linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px);
		background-size: 20px 20px;
		z-index: 1;
	}
	
	.color-handle {
		position: absolute;
		width: 14px;
		height: 14px;
		background-color: white;
		border: 2px solid #333;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
		z-index: 3;
	}
	
	.mini-preview {
		width: 24px;
		height: 24px;
		margin: 8px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
</style> 