import { tolerance } from '$lib/stores/configuration.js';

export const map = (value, start1, stop1, start2, stop2) => {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

export const isWithinTolerance = (a, b) => {
    return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

