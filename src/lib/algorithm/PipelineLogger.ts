/**
 * Logger for the tiling generation pipeline.
 * Centralizes progress bar formatting and step timing to avoid boilerplate.
 */

function progressBar(current: number, total: number, width = 30): string {
	if (total <= 0) return '[' + '='.repeat(width) + ']';
	const pct = current / total;
	const filled = Math.round(width * pct);
	return '[' + '='.repeat(filled) + ' '.repeat(width - filled) + `] ${(pct * 100).toFixed(1)}%`;
}

function formatRate(rate: number): string {
	if (rate >= 1) {
		if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k/s`;
		if (rate >= 100) return `${Math.round(rate)}/s`;
		return `${rate.toFixed(1)}/s`;
	}
	return `${(rate * 60).toFixed(1)}/min`;
}

function formatEta(secondsRemaining: number): string {
	if (secondsRemaining < 60) return `ETA ${Math.round(secondsRemaining)}s`;
	if (secondsRemaining < 3600) {
		const m = Math.floor(secondsRemaining / 60);
		const s = Math.round(secondsRemaining % 60);
		return s > 0 ? `ETA ${m}m ${s}s` : `ETA ${m}m`;
	}
	const h = Math.floor(secondsRemaining / 3600);
	const m = Math.round((secondsRemaining % 3600) / 60);
	return m > 0 ? `ETA ${h}h ${m}m` : `ETA ${h}h`;
}

export type ProgressCallback = (current: number, total: number, extra?: string | number) => void;

export type OuterProgress = { current: number; total: number };

export type PhaseProgressCallback = (
	phase: string,
	current: number,
	total: number,
	extra?: string,
	outer?: OuterProgress
) => void;

export class PipelineLogger {
	private stepNum = 0;
	private totalSteps = 0;
	private progressStartTime: number | null = null;
	private progressLastTotal: number | null = null;
	private lastProgressWasNested = false;

	constructor(totalSteps: number) {
		this.totalSteps = totalSteps;
	}

	log(msg: string): void {
		process.stdout.write(msg + '\n');
	}

	clearLine(width = 80, lines = 1): void {
		this.progressStartTime = null;
		this.progressLastTotal = null;
		this.lastProgressWasNested = false;
		if (lines === 1) {
			process.stdout.write('\r\x1b[2K');
		} else {
			process.stdout.write('\x1b[' + lines + 'A\x1b[2K');
			for (let i = 1; i < lines; i++) {
				process.stdout.write('\n\x1b[2K');
			}
			process.stdout.write('\r');
		}
	}

	/** Run a step with automatic timing and completion logging. */
	runStep<T>(name: string, fn: () => T, onComplete?: (result: T) => void): T {
		this.stepNum++;
		const start = performance.now();
		this.log(`Step ${this.stepNum}/${this.totalSteps}: ${name}...`);
		try {
			const result = fn();
			const end = performance.now();
			this.log(`  ✓ ${name}: ${(end - start).toFixed(0)}ms`);
			onComplete?.(result);
			this.log('');
			return result;
		} catch (e) {
			const end = performance.now();
			this.log(`  ✗ ${name}: failed after ${(end - start).toFixed(0)}ms\n`);
			throw e;
		}
	}

	/** Display progress with rate and ETA (tqdm-style). */
	progress(label: string, current: number, total: number, extra?: string): void {
		if (total !== this.progressLastTotal || this.progressStartTime === null) {
			this.progressStartTime = performance.now();
			this.progressLastTotal = total;
		}
		const elapsedSec = (performance.now() - this.progressStartTime) / 1000;
		const rate = elapsedSec >= 0.05 && current > 0 ? current / elapsedSec : 0;
		const etaSec = rate > 0 && current < total ? (total - current) / rate : 0;
		const rateStr = rate > 0 ? ` ${formatRate(rate)}` : '';
		const etaStr = etaSec > 0 ? ` ${formatEta(etaSec)}` : '';
		const extraStr = extra !== undefined ? ` ${extra}` : '';
		process.stdout.write(
			`\r  ${label}: ${progressBar(current, total)} ${current}/${total}${rateStr}${etaStr}${extraStr}   `
		);
	}

	/** Create a callback for SeedBuilder.buildSeeds: (current, total, count) => void */
	progressForSeeds(label: string): (current: number, total: number, count: number) => void {
		return (current, total, count) => {
			this.progress(label, current, total, `(${count} from last set)`);
		};
	}

	/** Display nested progress: outer bar (seeds) + inner bar (generator sets). */
	progressNested(
		outerLabel: string,
		outerCurrent: number,
		outerTotal: number,
		innerLabel: string,
		innerCurrent: number,
		innerTotal: number,
		extra?: string
	): void {
		if (outerTotal !== this.progressLastTotal || this.progressStartTime === null) {
			this.progressStartTime = performance.now();
			this.progressLastTotal = outerTotal;
		}
		const elapsedSec = (performance.now() - this.progressStartTime) / 1000;
		const rate = elapsedSec >= 0.05 && outerCurrent > 0 ? outerCurrent / elapsedSec : 0;
		const etaSec = rate > 0 && outerCurrent < outerTotal ? (outerTotal - outerCurrent) / rate : 0;
		const rateStr = rate > 0 ? ` ${formatRate(rate)}` : '';
		const etaStr = etaSec > 0 ? ` ${formatEta(etaSec)}` : '';
		const extraStr = extra !== undefined ? ` ${extra}` : '';

		const line1 = `  ${outerLabel}: ${progressBar(outerCurrent, outerTotal)} ${outerCurrent}/${outerTotal}${rateStr}${etaStr}${extraStr}`;
		const line2 =
			innerTotal > 0
				? `  ${innerLabel}: ${progressBar(innerCurrent, innerTotal)} ${innerCurrent}/${innerTotal}`
				: `  ${innerLabel}: (computing...)`;

		if (this.lastProgressWasNested) {
			process.stdout.write('\x1b[2A');
		}
		process.stdout.write('\r\x1b[2K' + line1 + '\n\r\x1b[2K' + line2 + '  ');
		this.lastProgressWasNested = true;
	}

	/** Create a callback for TilingGenerator: (phase, current, total, extra?, outer?) => void */
	progressForPhases(phaseLabels: Record<string, string>): PhaseProgressCallback {
		return (phase, current, total, extra, outer) => {
			const label = phaseLabels[phase] ?? phase;
			if (outer && phase === 'generators') {
				// Use outer progress for seeds, inner for generator sets
				const outerLabel = phaseLabels['seed'] ?? 'Seeds';
				this.progressNested(
					outerLabel,
					outer.current,
					outer.total,
					label,
					current,
					total,
					extra
				);
			} else {
				this.lastProgressWasNested = false;
				this.progress(label, current, total, extra);
			}
		};
	}

	/** Map over items with automatic progress display. */
	mapWithProgress<T, R>(
		items: T[],
		label: string,
		fn: (item: T, index: number) => R,
		updateInterval = 1
	): R[] {
		const total = items.length;
		const results: R[] = [];
		for (let i = 0; i < total; i++) {
			if (updateInterval <= 1 || i % updateInterval === 0 || i === total - 1) {
				this.progress(label, i + 1, total);
			}
			results.push(fn(items[i], i));
		}
		this.clearLine(70);
		return results;
	}

	/** Run a loop with progress. The fn receives a report function to call. */
	withProgress<T>(
		label: string,
		total: number,
		fn: (report: (current: number) => void) => T,
		updateInterval = 1
	): T {
		let lastReported = 0;
		const report = (current: number) => {
			if (updateInterval <= 1 || current - lastReported >= updateInterval || current === total) {
				this.progress(label, current, total);
				lastReported = current;
			}
		};
		const result = fn(report);
		this.clearLine(70);
		return result;
	}
}
