import type { SeedConfiguration, Vector } from "$lib/classes";

export class WallpaperGroup {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    /**
     * @param seed the seed configuration
     * @param vertices the vertices of the fundamental domain
     * @returns true if the shape and symmetries match those of the wallpaper group
     */
    checkValidity = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        return this.checkShape(vertices) && this.checkSymmetries(seed, vertices);
    }

    /**
     * @param seed the seed configuration
     * @param vertices the vertices of the fundamental domain
     * @returns true if the shape matches those of the wallpaper group
     */
    checkShape = (vertices: Vector[]): boolean => {
        return this.checkAngles(vertices) && this.checkSides(vertices);
    }
    
    /**
     * @param seed the seed configuration
     * @param vertices the vertices of the fundamental domain
     * @returns true if the symmetries match those of the wallpaper group
     */
    checkSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        return this.checkRotationalSymmetries(seed, vertices) && this.checkMirrorSymmetries(seed, vertices);
    }

    /**
     * @param vertices the vertices of the fundamental domain
     * @returns true if the angles match those of the wallpaper group
     */
    checkAngles = (vertices: Vector[]): boolean => {
        throw new Error('Abstract method');
    }

    /**
     * @param vertices the vertices of the fundamental domain
     * @returns true if the sides match those of the wallpaper group
     */
    checkSides = (vertices: Vector[]): boolean => {
        throw new Error('Abstract method');
    }

    /**
     * @param seed the seed configuration
     * @param vertices the vertices of the fundamental domain
     * @returns true if the mirror symmetries match those of the wallpaper group
     */
    checkMirrorSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        throw new Error('Abstract method');
    }

    /**
     * @param seed the seed configuration
     * @param vertices the vertices of the fundamental domain
     * @returns true if the rotational symmetries match those of the wallpaper group
     */
    checkRotationalSymmetries = (seed: SeedConfiguration, vertices: Vector[]): boolean => {
        throw new Error('Abstract method');
    }
}