import { tolerance } from '$lib/stores/configuration.js';

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