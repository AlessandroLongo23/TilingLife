import { tolerance } from '$lib/stores/configuration.js';

export const getSpatialKey = (x, y) => {
    const gridSize = tolerance * 2;
    const hashX = Math.floor(x / gridSize);
    const hashY = Math.floor(y / gridSize);
    return `${hashX},${hashY}`;
};