import { tolerance } from '$stores';
import { parametricStarRegex, equilateralPolygonRegex, Vector, regularStarRegex, regularPolygonRegex, type PolygonSignatureData, PolygonType, StarVertexTypes, TriangleType, QuadrilateralType, type TriangleSignature, type QuadrilateralSignature, Polygon, genericPolygonRegex } from '$classes';
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
    } 
    
    if (name.match(regularStarRegex)) {
        const [, n, d, suffix] = name.match(regularStarRegex);
        return {
            type: PolygonType.STAR_REGULAR,
            n: parseInt(n),
            d: parseInt(d),
            startsWith: suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER,
        };
    } 
    
    if (name.match(parametricStarRegex)) {
        const [, n, value, suffix] = name.match(parametricStarRegex);
        return {
            type: PolygonType.STAR_PARAMETRIC,
            n: parseInt(n),
            alpha: toRadians(parseFloat(value)),
            startsWith: suffix === 'i' ? StarVertexTypes.INNER : StarVertexTypes.OUTER,
        };
    } 
    
    if (name.match(equilateralPolygonRegex)) {
        const [, n, angles] = name.match(equilateralPolygonRegex);
        return {
            type: PolygonType.EQUILATERAL,
            n: parseInt(n),
            angles: angles.split(';').map(a => toRadians(parseInt(a))),
        };
    }
    
    if (name.match(genericPolygonRegex)) {
        const [, n, sides, angles] = name.match(genericPolygonRegex);
        return {
            type: PolygonType.GENERIC,
            n: parseInt(n),
            sides: sides.split(';').map(s => parseFloat(s)),
            angles: angles.split(';').map(a => toRadians(parseInt(a))),
        };
    }
}

export const comparePolygonNames = (nameA: string, nameB: string, sortOrder: string[] = ['type', 'n', 'd', 'alpha']): number => {
    const dataA: PolygonSignatureData = extractDataFromPolygonName(nameA);
    const dataB: PolygonSignatureData = extractDataFromPolygonName(nameB);

    const typesOrder = [
        PolygonType.REGULAR, 
        PolygonType.STAR_REGULAR, 
        PolygonType.STAR_PARAMETRIC, 
        PolygonType.EQUILATERAL, 
        PolygonType.GENERIC
    ];
    const typeAIndex = typesOrder.indexOf(dataA.type);
    const typeBIndex = typesOrder.indexOf(dataB.type);

    for (const field of sortOrder) {
        if (field === 'type') {
            if (typeAIndex !== typeBIndex) return typeAIndex - typeBIndex;
            continue;
        }
        const valA = (dataA as unknown as Record<string, number | undefined>)[field] ?? -Infinity;
        const valB = (dataB as unknown as Record<string, number | undefined>)[field] ?? -Infinity;
        if (valA !== valB) return valA - valB;
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

export const evaluateTriangle = (vertices: Vector[]): TriangleSignature => {
    if (vertices.length !== 3) return { types: [TriangleType.INVALID], vertices: [], rightVertexIndex: null };
    let rightVertexIndex: number | null = null;

    // CORRECT ANGLE CALCULATION: Angle between adjacent edges, not position vectors
    vertices = sortPointsByAngle(vertices);
    const angles = vertices.map((v, i) => {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length];
        const next = vertices[(i + 1) % vertices.length];
        const edge1 = Vector.sub(prev, v);
        const edge2 = Vector.sub(next, v);
        const angle = Vector.angleBetween(edge1, edge2); 
        if (isWithinTolerance(angle, Math.PI / 2)) rightVertexIndex = i;
        return angle;
    });

    // Use a standard helper for grouping floats safely, or keep your Set trick 
    // (but ensure Math.PI / 2 maps exactly to the tolerance bin)
    const uniqueAngles = new Set(angles.map(a => Math.round(a / tolerance) * tolerance));
    const rightAngleBin = Math.round((Math.PI / 2) / tolerance) * tolerance;

    const types: TriangleType[] = [];

    // Check for 90 degrees
    if (uniqueAngles.has(rightAngleBin)) {
        types.push(TriangleType.RIGHT);
    }

    // Side/Angle uniqueness classifications
    if (uniqueAngles.size === 1) {
        types.push(TriangleType.EQUILATERAL);
    } else if (uniqueAngles.size === 2) {
        types.push(TriangleType.ISOSCELES);
    } else if (uniqueAngles.size === 3) {
        types.push(TriangleType.SCALENE);
    }

    return { types: types.length > 0 ? types : [TriangleType.INVALID], vertices: vertices, rightVertexIndex: rightVertexIndex };
}

export const evaluateQuadrilateral = (vertices: Vector[]): QuadrilateralSignature => {
    if (vertices.length !== 4) return { types: [QuadrilateralType.INVALID], vertices: [] };

    // CORRECT CALCULATIONS
    vertices = sortPointsByAngle(vertices);
    const angles = vertices.map((v, i) => {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length];
        const next = vertices[(i + 1) % vertices.length];
        const edge1 = Vector.sub(prev, v);
        const edge2 = Vector.sub(next, v);
        return Vector.angleBetween(edge1, edge2);
    });
    const sides = vertices.map((v, i) => Vector.distance(v, vertices[(i + 1) % vertices.length]));

    const uniqueAngles = new Set(angles.map(a => Math.round(a / tolerance) * tolerance));
    const uniqueSides = new Set(sides.map(s => Math.round(s / tolerance) * tolerance));

    if (uniqueAngles.size > 2 || uniqueSides.size > 2) return { types: [QuadrilateralType.INVALID], vertices: [] };

    // All angles equal (must be 90 degrees in a quad)
    if (uniqueAngles.size === 1) {
        if (uniqueSides.size === 1) return { types: [QuadrilateralType.SQUARE, QuadrilateralType.RECTANGLE, QuadrilateralType.RHOMBUS], vertices: vertices };
        if (uniqueSides.size === 2) return { types: [QuadrilateralType.RECTANGLE, QuadrilateralType.PARALLELOGRAM], vertices: vertices };
    }

    // Check if opposite sides are equal to filter out Kites
    const isParallelogram = 
        Math.abs(sides[0] - sides[2]) < tolerance && 
        Math.abs(sides[1] - sides[3]) < tolerance;

    if (!isParallelogram) return { types: [QuadrilateralType.INVALID], vertices: [] };

    // All sides equal (Rhombus family)
    if (uniqueSides.size === 1) {
        const sixtyDegBin = Math.round((Math.PI / 3) / tolerance) * tolerance;
        const oneTwentyDegBin = Math.round((2 * Math.PI / 3) / tolerance) * tolerance;
        
        if (uniqueAngles.has(sixtyDegBin) && uniqueAngles.has(oneTwentyDegBin)) {
            return { types: [QuadrilateralType.HEX_UNIT, QuadrilateralType.RHOMBUS, QuadrilateralType.PARALLELOGRAM], vertices: vertices };
        }
        return { types: [QuadrilateralType.RHOMBUS, QuadrilateralType.PARALLELOGRAM], vertices: vertices };
    }

    // If it's a parallelogram but not a rhombus or rectangle
    return { types: [QuadrilateralType.PARALLELOGRAM], vertices: vertices };
}

export const sortPointsByAngle = (vertices: Vector[]): Vector[] => {
    const centroid = vertices.reduce((acc, v) => Vector.add(acc, v), new Vector(0, 0)).scale(1 / vertices.length);
    return vertices.sort((a, b) => Vector.sub(a, centroid).heading() - Vector.sub(b, centroid).heading());
}

export const isWithinConvexHull = (vertices: Vector[], point: Vector): boolean => {
    return sdf(vertices, point) < -tolerance;
}

export const sdf = (vertices: Vector[], point: Vector): number => {
    let minDistanceSq: number = Infinity;
    let inside: boolean = false;
    const verticesSorted: Vector[] = sortPointsByAngle(vertices);

    for (let i = 0, j = verticesSorted.length - 1; i < verticesSorted.length; j = i++) {
        const vi: Vector = verticesSorted[j];
        const vj: Vector = verticesSorted[i];
        const ex: number = vj.x - vi.x;
        const ey: number = vj.y - vi.y;
        const wx: number = point.x - vi.x;
        const wy: number = point.y - vi.y;
        const eLenSq: number = ex * ex + ey * ey;
        let t: number = Math.max(0, Math.min(1, (wx * ex + wy * ey) / eLenSq));

        if (isNaN(t)) t = 0;
        const cx: number = vi.x + t * ex;
        const cy: number = vi.y + t * ey;
        const dx: number = point.x - cx;
        const dy: number = point.y - cy;
        const distSq: number = dx * dx + dy * dy;
        
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
        }
        const intersect: boolean = ((vi.y > point.y) !== (vj.y > point.y)) && (point.x < (vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x);
        
        if (intersect) {
            inside = !inside;
        }
    }
    const distance: number = Math.sqrt(minDistanceSq);
    return inside ? -distance : distance;
}

export const deduplicatePolygons = (polygons: Polygon[]): Polygon[] => {
    return polygons.filter((p: Polygon, idx: number, self: Polygon[]) => {
        return idx === self.findIndex((other: Polygon) => p.isEquivalent(other));
    });
}

export const getAngleAtVertex = (vertices: Vector[], coordinate: Vector): number => {
    const vertex = vertices.find(v => isWithinTolerance(v, coordinate));
    if (vertex) {
        const index = vertices.indexOf(vertex);
        const u = Vector.sub(vertices[(index + 1) % vertices.length], vertex);
        const v = Vector.sub(vertex, vertices[(index - 1 + vertices.length) % vertices.length]);
        return (v.heading() - u.heading() + 5 * Math.PI) % (2 * Math.PI);
    }
    return 0;
}