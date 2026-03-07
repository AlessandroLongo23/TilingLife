/**
 * Conway's Magic Theorem: topological cost for Euclidean 2D tilings.
 * The sum of generator costs must equal exactly 2 for a valid wallpaper group.
 *
 * Costs:
 * - Gyration (rotation) of order n: C = (n-1)/n
 * - Mirror line (*): C = 1
 * - Glide reflection (x): C = 1
 * - Corner (two mirrors at π/n): C = (n-1)/n
 */

import { Vector, type Gyration, type Reflection } from "$classes";
import { isWithinTolerance } from "$utils";

/** Target cost for Euclidean plane tilings */
export const CONWAY_TARGET = 2;

/** Tolerance for floating-point equality */
const EPS = 1e-9;

/** Allowed angles (degrees) between reflection/glide axes in wallpaper groups */
const ALLOWED_AXIS_ANGLES_DEG = [0, 30, 45, 60, 90];

/** Tolerance for angle comparison in degrees */
const ANGLE_TOLERANCE_DEG = 1e-6;

/**
 * Cost of a single generator.
 * - Gyration of order n: (n-1)/n
 * - Reflection (mirror): 1
 */
export function conwayCost(generator: Gyration | Reflection): number {
    if ("order" in generator) {
        const g = generator as Gyration;
        return (g.order - 1) / g.order;
    }
    return 1; // Reflection
}

/**
 * Sum of Conway costs for a set of generators.
 */
export function conwayCostSum(generators: (Gyration | Reflection)[]): number {
    return generators.reduce((sum, g) => sum + conwayCost(g), 0);
}

/**
 * Returns true if the generator set has cost exactly 2 (Euclidean).
 */
export function isConwayValid(generators: (Gyration | Reflection)[]): boolean {
    return Math.abs(conwayCostSum(generators) - CONWAY_TARGET) < EPS;
}

/**
 * Extracts axis-bearing generators (Reflections and GlideReflections) and returns
 * their normalized direction vectors.
 */
function getAxisDirections(generators: (Gyration | Reflection)[]): Vector[] {
    const directions: Vector[] = [];
    for (const g of generators) {
        if ("axis" in g && g.axis) {
            const axis = g.axis as Vector;
            const mag = axis.mag();
            if (mag > EPS) {
                directions.push(axis.copy().scale(1 / mag));
            }
        }
    }
    return directions;
}

/**
 * Returns true if all pairs of reflection/glide axes in the generator set
 * form allowed angles (0°, 30°, 45°, 60°, 90°). Used to prune invalid
 * generator sets before collision testing.
 */
export function hasValidAxisAngles(generators: (Gyration | Reflection)[]): boolean {
    const directions = getAxisDirections(generators);
    if (directions.length < 2) return true;

    for (let i = 0; i < directions.length; i++) {
        for (let j = i + 1; j < directions.length; j++) {
            const dir1 = directions[i];
            const dir2 = directions[j];
            const dot = Math.abs(dir1.dot(dir2));
            const angleRad = Math.acos(Math.min(dot, 1));
            const angleDeg = (angleRad * 180) / Math.PI;

            const isAllowed = ALLOWED_AXIS_ANGLES_DEG.some((allowed) =>
                isWithinTolerance(angleDeg, allowed, ANGLE_TOLERANCE_DEG)
            );
            if (!isAllowed) return false;
        }
    }
    return true;
}
