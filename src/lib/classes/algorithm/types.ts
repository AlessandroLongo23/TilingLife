export enum PolygonCategory {
    REGULAR = 'regular',
    STAR_REGULAR = 'star_regular',
    STAR_PARAMETRIC = 'star_parametric',
}

export interface GeneratorParameters {
    categories: PolygonCategory[];
    angle: number;
    n_max: number;
}