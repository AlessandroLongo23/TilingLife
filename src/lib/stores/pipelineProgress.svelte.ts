import { writable } from 'svelte/store';

/**
 * Store for pipeline progress dialog.
 * Use open(), update(), and close() to control the dialog from API calls.
 */
export type PipelineProgressState = {
	isOpen: boolean;
	title: string;
	progress: number | null; // 0-100, or null for indeterminate
	message: string;
	canClose: boolean; // false while in progress, true when done or error
};

const initialState: PipelineProgressState = {
	isOpen: false,
	title: '',
	progress: null,
	message: '',
	canClose: false,
};

export const pipelineProgress = writable<PipelineProgressState>(initialState);

export function openPipelineProgress(title: string, message = '') {
	pipelineProgress.set({
		isOpen: true,
		title,
		progress: null,
		message,
		canClose: false,
	});
}

export function updatePipelineProgress(progress: number | null, message: string) {
	pipelineProgress.update((s) => ({ ...s, progress, message }));
}

export function closePipelineProgress() {
	pipelineProgress.update((s) => ({ ...s, isOpen: false, canClose: false }));
}

export function completePipelineProgress(message = 'Done') {
	pipelineProgress.update((s) => ({
		...s,
		progress: 100,
		message,
		canClose: true,
	}));
}

export function failPipelineProgress(message: string) {
	pipelineProgress.update((s) => ({
		...s,
		message,
		canClose: true,
	}));
}
