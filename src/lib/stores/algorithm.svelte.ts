import { PolygonType } from "../classes/polygons/PolygonType.svelte";

export const BATCH_SIZE = 1000;

export const categoryOptions = [
    { id: PolygonType.REGULAR, label: 'Regular' },
    { id: PolygonType.STAR_REGULAR, label: 'Star Regular' },
    { id: PolygonType.STAR_PARAMETRIC, label: 'Star Parametric' },
    { id: PolygonType.EQUILATERAL, label: 'Equilateral' },
    { id: PolygonType.GENERIC, label: 'Generic' },
];