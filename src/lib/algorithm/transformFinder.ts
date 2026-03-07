import { SeedConfiguration, Vector, type Gyration, type Reflection } from "$classes";
import { gyrationOrders } from "$classes/TilingChecker.svelte";

/** Orders to check, ascending. An order N is only checked if all its divisors in this set have already succeeded. */
const ordersAscending = [...gyrationOrders].sort((a, b) => a - b);

/** Returns proper divisors of n that are in the candidate set (excluding 1 and n). */
function getDivisorsInSet(n: number, candidates: number[]): number[] {
    return candidates.filter((d) => d < n && n % d === 0);
}

/**
 * Finds all gyration centers (rotation symmetries) for a seed configuration.
 * Mutates seed.gyrations in place.
 * Checks orders in ascending order; if an order fails, its multiples are skipped (e.g. fail 2 → skip 4,6).
 * @param seed - The seed configuration to find gyration centers for.
 * @param points - The points to find gyration centers for.
 */
export function findGyration(seed: SeedConfiguration, points: Vector[]): void {
    for (const point of points) {
        const succeeded = new Set<number>();
        let highestOrder = 0;

        for (const order of ordersAscending) {
            const divisors = getDivisorsInSet(order, ordersAscending);
            if (!divisors.every((d) => succeeded.has(d))) continue;

            let isValid = true;
            for (let i = 1; i < order; i++) {
                const rotatedSeed = SeedConfiguration.rotate(seed, point, (2 * Math.PI * i) / order);
                if (!rotatedSeed.isEquivalent(seed)) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) {
                succeeded.add(order);
                highestOrder = order;
            }
        }

        if (highestOrder > 0) {
            seed.gyrations.push({ center: point.copy(), order: highestOrder });
        }
    }
}

/**
 * Finds all reflection axes for a seed configuration.
 * Mutates seed.reflections in place.
 * @param seed - The seed configuration to find reflection axes for.
 */
export function findReflection(seed: SeedConfiguration): void {
    // generate all candidate reflections
    let candidates: Reflection[] = [];
    // for each polygon, the candidates are only:
    for (const polygon of seed.polygons) {
        for (let i = 0; i < polygon.vertices.length; i++) {
            // the axis is the vector from the centroid to the vertex
            const vertex = polygon.vertices[i];
            candidates.push({
                axis: Vector.sub(vertex, polygon.centroid).normalize(),
                point: polygon.centroid.copy(),
            });

            // the axis is the vector from the vertex to the next vertex
            const nextVertex = polygon.vertices[(i + 1) % polygon.vertices.length];
            candidates.push({
                axis: Vector.sub(vertex, nextVertex).normalize(),
                point: nextVertex.copy(),
            });
        }

        // for each halfway, the candidates are only the vector from the halfway to the centroid
        for (const halfway of polygon.halfways) {
            candidates.push({
                axis: Vector.sub(halfway, polygon.centroid).normalize(),
                point: polygon.centroid.copy(),
            });
        }
    }

    // remove candidates that are coincident with an earlier one (keep first of each coincident group)
    candidates = candidates.filter(
        (candidate, index) =>
            !candidates.slice(0, index).some((other) => isCoincident(candidate, other))
    );

    // test the candidates against the seed
    seed.reflections = [];
    for (const candidate of candidates) {
        const reflectedSeed = SeedConfiguration.mirror(seed, candidate.point, candidate.axis);
        if (reflectedSeed.isEquivalent(seed)) {
            seed.reflections.push(candidate);
        }
    }
}

/**
 * Checks if two reflection axes are coincident.
 * @param a - The first reflection.
 * @param b - The second reflection.
 * @returns True if the reflections are coincident, false otherwise.
 */
export const isCoincident = (a: Reflection, b: Reflection): boolean => {
    if (!a.axis.isParallelTo(b.axis)) return false;
    return Vector.belongsToLine(a.point, { axis: b.axis, point: b.point });
}
