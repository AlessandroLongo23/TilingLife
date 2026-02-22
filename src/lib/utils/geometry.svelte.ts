import { tolerance } from '$stores';
import { Vector } from '$classes';
import { isWithinTolerance } from './math.svelte';

export const sortPointsByAngleAndDistance = (points) => {
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

export const getClockwiseAngle = (point) => {
    if (Math.abs(point.x) < tolerance)
        return point.y > 0 ? 0 : Math.PI;

    let angle = Math.PI / 2 - Math.atan2(point.y, point.x);
    
    if (angle < 0) {
        angle += 2 * Math.PI;
    }

    return angle;
}

export const apothem = (n) => {
    return 0.5 / Math.tan(Math.PI / n);
}

export const angleBetween = (a, b, c) => {
    let v1 = new Vector(a.x - b.x, a.y - b.y);
    let v2 = new Vector(c.x - b.x, c.y - b.y);

    return (v1.heading() - v2.heading() + Math.PI) % Math.PI;
}

// export const isTriangleOverlappingHexagon = (triangle, existingNodes) => {
//     if (triangle.n !== 3) return false;
    
//     const hexagons = existingNodes.filter(node => node.n === 6);
//     if (hexagons.length === 0) return false;
    
//     for (let i = 0; i < hexagons.length; i++) {
//         const hexagon = hexagons[i];
        
//         if (p5.dist(triangle.centroid.x, triangle.centroid.y, hexagon.centroid.x, hexagon.centroid.y) > 2) {
//             continue;
//         }
        
//         let centroidMatchFound = false;
//         let centroidMatchVertex = -1;
        
//         for (let j = 0; j < triangle.vertices.length; j++) {
//             if (p5.isWithinTolerance(triangle.vertices[j], hexagon.centroid)) {
//                 centroidMatchFound = true;
//                 centroidMatchVertex = j;
//                 break;
//             }
//         }
        
//         if (!centroidMatchFound) continue;
        
//         let vertexMatches = 0;
        
//         for (let j = 0; j < triangle.vertices.length; j++) {
//             if (j === centroidMatchVertex) continue;
            
//             for (let k = 0; k < hexagon.vertices.length; k++) {
//                 if (p5.isWithinTolerance(triangle.vertices[j], hexagon.vertices[k])) {
//                     vertexMatches++;
//                     break;
//                 }
//             }
//         }
        
//         if (vertexMatches >= 2) {
//             return true;
//         }
//     }
    
//     return false;
// }

// export const isHexagonCoveredByTriangles = (hexagon, existingNodes) => {
//     if (hexagon.n !== 6) return false;
    
//     const triangles = existingNodes.filter(node => node.n === 3);
//     const coveredVertices = new Set();
    
//     for (let i = 0; i < hexagon.vertices.length; i++) {
//         const hexVertex = hexagon.vertices[i];
        
//         for (let j = 0; j < triangles.length; j++) {
//             const triangle = triangles[j];
            
//             if (p5.dist(hexagon.centroid.x, hexagon.centroid.y, triangle.centroid.x, triangle.centroid.y) > 2) {
//                 continue;
//             }
            
//             for (let k = 0; k < triangle.vertices.length; k++) {
//                 if (p5.isWithinTolerance(hexVertex, triangle.vertices[k])) {
//                     coveredVertices.add(i);
//                     break;
//                 }
//             }
//         }
//     }
    
//     if (coveredVertices.size >= 2) {
//         const trianglesPointingInward = triangles.filter(triangle => {
//             if (p5.dist(hexagon.centroid.x, hexagon.centroid.y, triangle.centroid.x, triangle.centroid.y) > 2) {
//                 return false;
//             }
            
//             for (let i = 0; i < triangle.vertices.length; i++) {
//                 if (isWithinTolerance(triangle.vertices[i], hexagon.centroid)) {
//                     return true;
//                 }
//             }
//             return false;
//         });
        
//         return trianglesPointingInward.length >= 2;
//     }
    
//     return false;
// }

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
    if (isWithinTolerance(p1, p3) || isWithinTolerance(p1, p4) || isWithinTolerance(p2, p3) || isWithinTolerance(p2, p4)) {
        return false;
    }
    
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < tolerance) {
        return false;
    }
    
    const numT = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
    const numU = (p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x);
    const t = numT / denom;
    const u = numU / denom;
    if (t > -tolerance && t < 1 + tolerance && u > -tolerance && u < 1 + tolerance) {
        return true;
    }
    return false;
}