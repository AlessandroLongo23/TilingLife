import { tolerance } from '../stores/configuration';
import { Vector } from '../classes/Vector.svelte';

export const map = (value: number, start1: number, stop1: number, start2: number, stop2: number): number => {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

export const isWithinTolerance = (a: number | Vector, b: number | Vector): boolean => {
    if (typeof a === 'number' && typeof b === 'number') {
        return Math.abs(a - b) < tolerance;
    } else if (a instanceof Vector && b instanceof Vector) {
        return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
    } else {
        return false;
    }
}

export const toRadians = (angle: number, possibleAngles?: number[], defaultAngle: number = 180): number => {
    if (possibleAngles && !possibleAngles.includes(angle)) {
        console.error('Invalid angle', angle);
        angle = defaultAngle as number;
    }
    return angle * Math.PI / 180;
}