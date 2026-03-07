import { tolerance } from '$stores';
import { Vector } from '$classes';

export const map = (value: number, start1: number, stop1: number, start2: number, stop2: number): number => {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

/**
 * 
 * @param a - The first number to compare, or vector
 * @param b - The second number to compare, or vector
 * @param tol - The tolerance to use, defaults to the tolerance store
 * @returns True if the numbers/vectors are equal within the tolerance, false otherwise
 */
export const isWithinTolerance = (a: number | Vector, b: number | Vector, tol: number = tolerance): boolean => {
    if (typeof a === 'number' && typeof b === 'number') {
        return Math.abs(a - b) < tol;
    } else if (a instanceof Vector && b instanceof Vector) {
        return Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol;
    } else {
        return false;
    }
}

/**
 * 
 * @param a - The first angle (in radians) to compare, or vector representing the angle
 * @param b - The second angle (in radians) to compare, or vector representing the angle
 * @returns True if the angles are equal within the tolerance, false otherwise
 */
export const isWithinAngularTolerance = (a: number | Vector, b: number | Vector): boolean => {
    let angleA: number;
    let angleB: number;
    if (typeof a === 'number' && typeof b === 'number') {
        angleA = a;
        angleB = b;
    } else if (a instanceof Vector && b instanceof Vector) {
        angleA = a.heading();
        angleB = b.heading();
    } else {
        return false;
    }

    let diff = Math.abs((angleA - angleB) % (2 * Math.PI));
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }
    return diff < tolerance;
}

export const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
}

export const coprime = (a: number, b: number): boolean => {
    return gcd(a, b) === 1;
}
