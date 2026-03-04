import { comparePolygonNames } from "./geometry.svelte";

export const compareArrays = (a: any[], b: any[]): number => {
    if (a.length !== b.length) return a.length - b.length;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            if (typeof a[i] === 'string' && typeof b[i] === 'string') {
                return a[i].localeCompare(b[i]);
            } else {
                return a[i] - b[i];
            }
        }
    }

    return 0;
}

export const cyclicallyInclude = (a: string[], b: string[]): boolean => {
    const aString = a.concat(a).join(',');
    const bString = b.join(',');
    return aString.includes(bString);
}

export const cycleToMinimumLexicographicalOrder = (array: number[]): number[] => {
    let min = array.slice(0);
    for (let i = 0; i < array.length; i++) {
        let rotated = array.slice(i).concat(array.slice(0, i));
        if (compareArrays(rotated, min) < 0) {
            min = rotated;
        }
    }
    return min;
}

export const isEqual = (arrayA: number[], arrayB: number[]): boolean => {
    if (arrayA.length !== arrayB.length) return false;
    for (let i = 0; i < arrayA.length; i++)
        if (arrayA[i] !== arrayB[i]) return false;
    return true;
}

export const isEqualOrChiral = (arrayA: number[], arrayB: number[]): boolean => {
    if (arrayA.length !== arrayB.length) return false;
    
    for (let i = 0; i < arrayA.length; i++) {
        let rotated = arrayA.slice(i).concat(arrayA.slice(0, i));
        if (isEqual(rotated, arrayB)) return true;
    }

    let reversed = arrayA.slice().reverse();
    for (let i = 0; i < arrayA.length; i++) {
        let rotated = reversed.slice(i).concat(reversed.slice(0, i));
        if (isEqual(rotated, arrayB)) return true;
    }

    return false;
}

export const compareVCNames = (polygonNamesA: string[], polygonNamesB: string[]): number => {
    for (let i = 0; i < polygonNamesA.length; i++) {
        if (!polygonNamesB[i]) return 1;
        if (!polygonNamesA[i]) return -1;
        
        const result = comparePolygonNames(polygonNamesA[i], polygonNamesB[i]);
        if (result !== 0) return result;
    }
    return 0;
}