import { writable } from 'svelte/store';

export let rule = writable('');
export let transform_steps = writable(0);
export let side = writable(50);
export let show_construction_points = writable(false);