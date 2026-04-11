<script lang="ts">
	import { sounds } from '$utils';

	/**
	 * RangeSlider - A slider that supports both single-value and range (interval) modes.
	 * - Pass a number for value → single-thumb slider (normal slider)
	 * - Pass [start, end] for value → dual-thumb range slider (interval)
	 */
	let {
		id,
		label,
		value = $bindable([0, 0]),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		unit = ''
	}: {
		id?: string;
		label?: string;
		value: [number, number];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		unit?: string;
	} = $props();

	const isRangeMode = $derived(Array.isArray(value));
	const rangeMin = $derived(isRangeMode ? (value as [number, number])[0] : min);
	const rangeMax = $derived(isRangeMode ? (value as [number, number])[1] : max);
	const isCollapsed = $derived(isRangeMode && rangeMin === rangeMax);

	let lastLow = $state(min);
	let lastHigh = $state(max);

	function handleSingleMouseMove(e: MouseEvent) {
		if (e.buttons === 1) {
			const newValue = Number((e.target as HTMLInputElement).value);
			if (newValue !== lastLow) {
				sounds.slider(0.02);
				lastLow = newValue;
			}
			value = newValue;
		}
	}

	function handleCollapsedInput(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		const current = rangeMin;
		if (v > current) {
			value = [current, v];
		} else if (v < current) {
			value = [v, current];
		} else {
			value = [v, v];
		}
	}

	function handleCollapsedMouseMove(e: MouseEvent) {
		if (e.buttons === 1) {
			const newValue = Number((e.target as HTMLInputElement).value);
			const current = rangeMin;
			const prevLow = (value as [number, number])[0];
			const prevHigh = (value as [number, number])[1];
			if (newValue > current) {
				if (current !== prevLow || newValue !== prevHigh) sounds.slider(0.02);
				lastLow = current;
				lastHigh = newValue;
				value = [current, newValue];
			} else if (newValue < current) {
				if (newValue !== prevLow || current !== prevHigh) sounds.slider(0.02);
				lastLow = newValue;
				lastHigh = current;
				value = [newValue, current];
			} else {
				if (newValue !== lastLow) sounds.slider(0.02);
				lastLow = newValue;
				lastHigh = newValue;
				value = [newValue, newValue];
			}
		}
	}

	function handleLowInput(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		const high = (value as [number, number])[1];
		value = [Math.min(v, high), high];
	}

	function handleHighInput(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		const low = (value as [number, number])[0];
		value = [low, Math.max(v, low)];
	}

	function handleRangeMouseMove(e: MouseEvent, which: 'low' | 'high') {
		if (e.buttons === 1) {
			const target = e.target as HTMLInputElement;
			const newVal = Number(target.value);
			const [low, high] = value as [number, number];
			if (which === 'low') {
				const clamped = Math.min(newVal, high);
				if (clamped !== lastLow) {
					sounds.slider(0.02);
					lastLow = clamped;
				}
				value = [clamped, high];
			} else {
				const clamped = Math.max(newVal, low);
				if (clamped !== lastHigh) {
					sounds.slider(0.02);
					lastHigh = clamped;
				}
				value = [low, clamped];
			}
		}
	}

	$effect(() => {
		if (isRangeMode) {
			const [a, b] = value as [number, number];
			lastLow = a;
			lastHigh = b;
		} else {
			const v = value as number;
			lastLow = v;
			lastHigh = v;
		}
	});

	const displayValue = $derived(
		isRangeMode
			? rangeMin === rangeMax
				? `${rangeMin}${unit ? ' ' + unit : ''}`
				: `${(value as [number, number])[0]} – ${(value as [number, number])[1]}${unit ? ' ' + unit : ''}`
			: `${value}${unit ? ' ' + unit : ''}`
	);

	const lowPercent = $derived(((rangeMin - min) / (max - min)) * 100);
	const highPercent = $derived(((rangeMax - min) / (max - min)) * 100);
</script>

<div class="grid w-full gap-1.5">
	{#if label}
		<div class="flex flex-row justify-between items-center">
			<label for={id} class="text-xs font-medium text-zinc-400">
				{label}
			</label>
			<span class="text-[10px] text-green-400/90 font-medium tabular-nums">{displayValue}</span>
		</div>
	{/if}

	{#if isRangeMode && isCollapsed}
		<!-- Collapsed range: single thumb when min === max -->
		<input
			id={id}
			type="range"
			value={rangeMin}
			oninput={handleCollapsedInput}
			onmousemove={handleCollapsedMouseMove}
			min={min}
			max={max}
			step={step}
			disabled={disabled}
			class="range-track w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700/60 accent-green-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
			aria-label="Exact value"
		/>
	{:else if isRangeMode}
		<!-- Dual-thumb range slider -->
		<div class="relative w-full h-5 flex items-center">
			<div
				class="absolute h-1.5 rounded-full bg-zinc-700/60 w-full pointer-events-none"
				aria-hidden="true"
			></div>
			<div
				class="absolute h-1.5 rounded-full bg-green-500/40 pointer-events-none transition-all"
				style="left: {lowPercent}%; width: {highPercent - lowPercent}%;"
				aria-hidden="true"
			></div>
			<input
				type="range"
				class="range-thumb absolute w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent accent-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				min={min}
				max={max}
				step={step}
				value={rangeMin}
				oninput={handleLowInput}
				onmousemove={(e) => handleRangeMouseMove(e, 'low')}
				disabled={disabled}
				aria-label="Range minimum"
			/>
			<input
				type="range"
				class="range-thumb absolute w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent accent-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				min={min}
				max={max}
				step={step}
				value={rangeMax}
				oninput={handleHighInput}
				onmousemove={(e) => handleRangeMouseMove(e, 'high')}
				disabled={disabled}
				aria-label="Range maximum"
			/>
		</div>
	{:else}
		<!-- Single-thumb slider -->
		<input
			id={id}
			type="range"
			bind:value
			onmousemove={handleSingleMouseMove}
			min={min}
			max={max}
			step={step}
			disabled={disabled}
			class="range-track w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700/60 accent-green-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
		/>
	{/if}
</div>

<style>
	.range-thumb::-webkit-slider-thumb,
	.range-track::-webkit-slider-thumb {
		appearance: none;
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: rgb(34 197 94 / 0.9);
		cursor: pointer;
		border: 1px solid rgb(34 197 94 / 0.4);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}
	.range-thumb::-webkit-slider-thumb:hover,
	.range-track::-webkit-slider-thumb:hover {
		transform: scale(1.08);
		box-shadow: 0 0 0 2px rgb(34 197 94 / 0.15);
	}
	.range-thumb::-moz-range-thumb,
	.range-track::-moz-range-thumb {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: rgb(34 197 94 / 0.9);
		cursor: pointer;
		border: 1px solid rgb(34 197 94 / 0.4);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}
	.range-thumb::-moz-range-thumb:hover,
	.range-track::-moz-range-thumb:hover {
		transform: scale(1.08);
		box-shadow: 0 0 0 2px rgb(34 197 94 / 0.15);
	}
</style>
