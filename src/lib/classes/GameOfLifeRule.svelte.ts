export enum GOLNeighborhood {
    VON_NEUMANN = 'vonNeumann',
    MOORE = 'moore',
}

export type GameOfLifeRule = {
    birth?: {
        min: number;
        max: number;
    } | number[];
    survival?: {
        min: number;
        max: number;
    } | number[];
    generations?: number;
    neighborhood?: GOLNeighborhood;
    range?: number;
};

export enum Behavior {
    DECREASING = 'decreasing',
    INCREASING = 'increasing',
    CHAOTIC = 'chaotic'
}

export enum State {
    DEAD = 0,
    ALIVE = 1
}

export enum GOLRuleType {
    SINGLE = 'single',
    BY_SHAPE = 'by_shape'
}