import { tolerance } from '$stores';
import { parametricStarRegex, equilateralPolygonRegex, Vector, regularStarRegex, regularPolygonRegex, type PolygonSignatureData, PolygonType, StarVertexTypes } from '$classes';
import { isWithinTolerance } from './math.svelte';

export const sortPointsByAngleAndDistance = (points: Vector[]): Vector[] => {
    return points.sort((a, b) => {
        const angleA = getClockwiseAngle(a);
        const angleB = getClockwiseAngle(b);
        
        if (Math.abs(angleA - angleB) < tolerance) {
            const distA = Math.sqrt(a.x ** 2 + a.y ** 2);
            const distB = Math.sqrt(b.x ** 2 + b.y ** 2);
            return distA - distB;
        }
        
        return angleA - angleB;
    });
};

export const getClockwiseAngle = (point: Vector): number => {
    if (Math.abs(point.x) < tolerance)
        return point.y > 0 ? 0 : Math.PI;

    let angle = Math.PI / 2 - Math.atan2(point.y, point.x);
    
    if (angle < 0) {
        angle += 2 * Math.PI;
    }

    return angle;
}

export const apothem = (n: number): number => {
    return 0.5 / Math.tan(Math.PI / n);
}

export const angleBetween = (a: Vector, b: Vector, c: Vector): number => {
    let v1 = new Vector(a.x - b.x, a.y - b.y);
    let v2 = new Vector(c.x - b.x, c.y - b.y);

    return (v1.heading() - v2.heading() + Math.PI) % Math.PI;
}

export const findIntersection = (p1: Vector, v1: Vector, p2: Vector, v2: Vector): Vector | null => {
    v1 = v1.normalize();
    v2 = v2.normalize();
    
    const det = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(det) < tolerance) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    const t = (dx * v2.y - dy * v2.x) / det;

    return Vector.add(p1, Vector.scale(v1, t));
}

export const toRadians = (angle: number, possibleAngles?: number[], defaultAngle: number = 180): number => {
    if (possibleAngles && !possibleAngles.includes(angle)) {
        console.error('Invalid angle', angle);
        angle = defaultAngle as number;
    }
    return angle * Math.PI / 180;
}

export const toDegrees = (radians: number): number => {
    let degrees = radians * 180 / Math.PI;
    degrees = Math.round(degrees * 10000) / 10000;
    return degrees;
}

export const segmentsIntersect = (p1: Vector, p2: Vector, p3: Vector, p4: Vector): boolean => {
    const isPointEqual = (a: Vector, b: Vector) => Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
    const p1p3 = isPointEqual(p1, p3);
    const p1p4 = isPointEqual(p1, p4);
    const p2p3 = isPointEqual(p2, p3);
    const p2p4 = isPointEqual(p2, p4);
    const sharedPoints = (p1p3 ? 1 : 0) + (p1p4 ? 1 : 0) + (p2p3 ? 1 : 0) + (p2p4 ? 1 : 0);
    if (sharedPoints === 2) return false;
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    const numT = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
    const numU = (p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x);
    if (Math.abs(denom) < tolerance) {
        if (Math.abs(numT) < tolerance && Math.abs(numU) < tolerance) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < tolerance) return false;
            const t3 = ((p3.x - p1.x) * dx + (p3.y - p1.y) * dy) / lenSq;
            const t4 = ((p4.x - p1.x) * dx + (p4.y - p1.y) * dy) / lenSq;
            const tMin = Math.min(t3, t4);
            const tMax = Math.max(t3, t4);
            if (tMin < 1 - tolerance && tMax > tolerance) return true;
        }
        return false;
    }
    const t = numT / denom;
    const u = numU / denom;
    const tInterior = t > tolerance && t < 1 - tolerance;
    const uInterior = u > tolerance && u < 1 - tolerance;
    if (tInterior && uInterior) return true;
    if (sharedPoints === 0) {
        const tOnSegment = t > -tolerance && t < 1 + tolerance;
        const uOnSegment = u > -tolerance && u < 1 + tolerance;
        if (tOnSegment && uOnSegment) return true;
    }
    return false;
};

export const extractDataFromPolygonName = (name: string): PolygonSignatureData => {
    if (name.match(regularPolygonRegex)) {
        return {
            type: PolygonType.REGULAR,
            n: parseInt(name)
        };
    } else if (name.match(regularStarRegex)) {
        const [, n, d, suffix] = name.match(regularStarRegex);
        return {
            type: PolygonType.STAR_REGULAR,
            n: parseInt(n),
            d: parseInt(d),
            startsWith: suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER,
        };
    } else if (name.match(parametricStarRegex)) {
        const [, n, value, suffix] = name.match(parametricStarRegex);
        return {
            type: PolygonType.STAR_PARAMETRIC,
            n: parseInt(n),
            alpha: toRadians(parseFloat(value)),
            startsWith: suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER,
        };
    } else if (name.match(equilateralPolygonRegex)) {
        const [, n, angles] = name.match(equilateralPolygonRegex);
        return {
            type: PolygonType.EQUILATERAL,
            n: parseInt(n),
            angles: angles.split(';').map(a => toRadians(parseInt(a))),
        };
    }
}

export const comparePolygonNames = (nameA: string, nameB: string): number => {
    const dataA: PolygonSignatureData = extractDataFromPolygonName(nameA);
    const dataB: PolygonSignatureData = extractDataFromPolygonName(nameB);

    const sortOrder = ['type', 'n', 'd', 'alpha'];
    const typesOrder = [PolygonType.REGULAR, PolygonType.STAR_REGULAR, PolygonType.STAR_PARAMETRIC, PolygonType.EQUILATERAL];
    const typeAIndex = typesOrder.indexOf(dataA.type);
    const typeBIndex = typesOrder.indexOf(dataB.type);

    for (const field of sortOrder) {
        if (field === 'type') {
            if (typeAIndex !== typeBIndex) return typeAIndex - typeBIndex;
            continue;
        }
        if (dataA[field] !== dataB[field]) return dataA[field] - dataB[field];
    }
    return 0;
}

export const compareVertexConfigurationNames = (nameA: string, nameB: string): number => {
    const polygonsA: string[] = nameA.split(',');
    const polygonsB: string[] = nameB.split(',');

    for (let i = 0; i < polygonsA.length; i++) {
        const polygonA: string = polygonsA[i];
        const polygonB: string = polygonsB[i];
        if (!polygonB) return 1;
        if (!polygonA) return -1;
        const result = comparePolygonNames(polygonA, polygonB);
        if (result !== 0) return result;
    }
    return 0;
}

/**
 * @param points - The points to deduplicate
 * @returns The deduplicated points
 * @description Deduplicates points by checking for equality with tolerance
 */
export const deduplicatePoints = (points: Vector[]): Vector[] => {
    const uniquePoints: Vector[] = [];
    for (const point of points) {
        if (!uniquePoints.some(p => isWithinTolerance(p, point))) {
            uniquePoints.push(point);
        }
    }
    return uniquePoints;
}