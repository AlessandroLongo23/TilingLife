import { writable } from 'svelte/store';

export interface HeaderState {
	title: string;
	badge: string | null;
	subtitle: string | null;
}

function createHeaderStore() {
	const { subscribe, set, update } = writable<HeaderState>({
		title: '',
		badge: null,
		subtitle: null
	});

	return {
		subscribe,
		set: (state: Partial<HeaderState>) =>
			update((prev) => ({ ...prev, ...state })),
		reset: () =>
			set({ title: '', badge: null, subtitle: null })
	};
}

export const headerStore = createHeaderStore();
