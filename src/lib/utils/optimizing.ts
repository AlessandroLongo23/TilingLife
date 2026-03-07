import { tolerance } from '$stores';

export const getSpatialKey = (x: number, y: number): string => {
    const gridSize = tolerance * 2;
    const hashX = Math.floor(x / gridSize);
    const hashY = Math.floor(y / gridSize);
    return `${hashX},${hashY}`;
};
