import { parameter, possibleSides, possibleAngles } from '$stores';
import { toRadians } from '$utils';
import { PolygonType, type ShapeSeed, type GameOfLifeRule, GOLNeighborhood, type RelativeTo, type RelativeToType, type Transform, TransformType } from '$classes';

export class Parser {
    dual: boolean;
    shapeSeed: ShapeSeed[][];
    transforms: Transform[];

    constructor() {}

    parseRule = (tilingRule: string) => {
        this.evaluateDual(tilingRule);
        tilingRule = this.expandExponents(tilingRule);
        const pieces = this.extractShapeSeed(tilingRule);
        this.extractTransforms(pieces);
    }

    evaluateDual = (tilingRule: string) => {
        this.dual = false;
        if (tilingRule[tilingRule.length - 1] === '*') {
            this.dual = true;
            tilingRule = tilingRule.slice(0, -1);
        }
    }

    expandExponents = (tilingRule: string): string => {
        return tilingRule.replace(/(\d+)\^(\d+)/g, (match: string, base: string, exponent: string) => {
            return base.concat(',').repeat(parseInt(exponent)).slice(0, -1);
        });
    }

    extractShapeSeed = (tilingRule: string): string[] => {
        const pieces = tilingRule.split('/');
        let shapeSeedLayers = pieces[0].split('-');
        this.shapeSeed = [];
        for (let i = 0; i < shapeSeedLayers.length; i++) {
            const shapeSeedLayer = shapeSeedLayers[i].split(',');
            this.shapeSeed.push([]);
            for (let j = 0; j < shapeSeedLayer.length; j++) {
                if (!this.isValidShapeSeed(shapeSeedLayer[j]))
                    throw new Error('Invalid shape seed');

                // star regular and parametric
                if (shapeSeedLayer[j].includes('{')) {
                    const content: string = shapeSeedLayer[j].split('{')[1].split('}')[0];
                    if (content.includes('.')) {
                        const n: number = parseInt(content.split('.')[0]);
                        const d: number = parseInt(content.split('.')[1]);
                        this.shapeSeed[i][j] = {
                            type: PolygonType.STAR_REGULAR,
                            n: n,
                            d: d
                        }
                    } else if (content.includes('|')) {
                        const n: number = parseInt(content.split('|')[0]);
                        const alphaString: string = content.split('|')[1];
                        let alpha: number = 0;
                        if (isNaN(parseInt(alphaString))) {
                            parameter.subscribe((v) => {
                                alpha = toRadians(v)
                            });
                        } else {
                            alpha = toRadians(parseInt(alphaString));
                        }
                        this.shapeSeed[i][j] = {
                            type: PolygonType.STAR_PARAMETRIC,
                            n: n,
                            alpha: alpha
                        };
                    }
                    continue;
                }

                const n: number = parseInt(shapeSeedLayer[j][0]);

                // equilateral
                if (shapeSeedLayer[j].includes('(') && shapeSeedLayer[j].includes('[')) {
                    let sides: number[] = shapeSeedLayer[j].split('[')[1].split(']')[0].split(';').map(Number);
                    if (n % sides.length != 0) {
                        throw new Error('Invalid shape seed');
                    } else {
                        sides = Array(n / sides.length).fill(sides).flat();
                    }
                    let angles: number[] = shapeSeedLayer[j].split('(')[1].split(')')[0].split(';').map(Number);
                    if (n % angles.length != 0) {
                        throw new Error('Invalid shape seed');
                    } else {
                        angles = Array(n / angles.length).fill(angles).flat();
                    }
                    this.shapeSeed[i][j] = {
                        type: PolygonType.EQUILATERAL,
                        n: n,
                        sides: sides,
                        angles: angles.map(angle => toRadians(angle))
                    };
                    continue;
                }

                // isotoxal
                if (shapeSeedLayer[j].includes('(')){
                    let angles: number[] = shapeSeedLayer[j].split('(')[1].split(')')[0].split(';').map(Number);
                    if (n % angles.length != 0) {
                        throw new Error('Invalid shape seed');
                    } else {
                        angles = Array(n / angles.length).fill(angles).flat();
                    }
                    this.shapeSeed[i][j] = {
                        type: PolygonType.ISOTOXAL,
                        n: n,
                        angles: angles.map(angle => toRadians(angle))
                    };
                    continue;
                }

                // isohedral
                if (shapeSeedLayer[j].includes('[')) {
                    let sides: number[] = shapeSeedLayer[j].split('[')[1].split(']')[0].split(';').map(Number);
                    if (n % sides.length != 0) {
                        throw new Error('Invalid shape seed');
                    } else {
                        sides = Array(n / sides.length).fill(sides).flat();
                    }
                    this.shapeSeed[i][j] = {
                        type: PolygonType.ISOHEDRAL,
                        n: n,
                        sides: sides
                    };
                    continue;
                }

                // regular
                this.shapeSeed[i][j] = {
                    type: PolygonType.REGULAR,
                    n: parseInt(shapeSeedLayer[j]),
                    special: shapeSeedLayer[j].includes("'")
                }
            }
        }
        if (this.shapeSeed.flat().some(n => !possibleSides.includes(n.n))) {
            throw new Error('Invalid shape seed');
        }

        return pieces;
    }

    extractTransforms = (pieces: string[]): void => {
        this.transforms = [];
        for (let i = 1; i < pieces.length; i++) {
            const type: TransformType = pieces[i][0] as TransformType;
            const piece: string = pieces[i];
            
            switch (type) {
                case TransformType.MIRROR:
                    this.transforms.push(this.extractMirrorTransform(piece));
                    break;
                case TransformType.ROTATE:
                    this.transforms.push(this.extractRotateTransform(piece));
                    break;
                case TransformType.TRANSLATE:
                    this.transforms.push(this.extractTranslateTransform(piece));
                    break;
                default:
                    throw new Error('Invalid transform type');
            }
        }
    }

    extractMirrorTransform = (piece: string): Transform => {
        let mirrorTransform = {};

        if (piece.includes('(') && piece.includes(')')) {
            let angle: number = 180;
            if (piece.includes('[') && piece.includes(']')) {
                angle = parseInt(piece.split('[')[1].split(']')[0]);
            }

            let relativeToString: string = piece.split('(')[1].split(')')[0];
            let relativeTo: RelativeTo = {
                type: relativeToString.charAt(0) as RelativeToType,
                index: parseInt(relativeToString.slice(1))
            };

            mirrorTransform = {
                type: TransformType.MIRROR,
                relativeTo: relativeTo,
                angle: toRadians(angle, possibleAngles),
                anchor: undefined
            };
        } else {
            let angle: number = parseInt(piece.slice(1)) || 180;

            mirrorTransform = {
                type: TransformType.MIRROR,
                angle: toRadians(angle, possibleAngles)
            };
        }

        return mirrorTransform as Transform;
    }

    extractRotateTransform = (piece: string): Transform => {
        let rotateTransform = {};

        if (piece.includes('(') && piece.includes(')')) {
            let angle = 180;
            if (piece.includes('[') && piece.includes(']')) {
                angle = parseInt(piece.split('[')[1].split(']')[0]);
            }
            angle = toRadians(angle, possibleAngles);

            let relativeToString: string = piece.split('(')[1].split(')')[0];
            let relativeTo: RelativeTo = {
                type: relativeToString.charAt(0) as RelativeToType,
                index: parseInt(relativeToString.slice(1))
            };

            rotateTransform = {
                type: TransformType.ROTATE,
                relativeTo: relativeTo,
                angle: angle,
                anchor: null
            }
        } else {
            const angle: number = parseInt(piece.slice(1));
            rotateTransform = {
                type: TransformType.ROTATE,
                angle: toRadians(angle, possibleAngles)
            }
        }

        return rotateTransform as Transform;
    }

    extractTranslateTransform = (piece: string): Transform => {
        let translateTransform = {};

        if (piece.includes('(') && piece.includes(')')) {
            let relativeToString: string = piece.split('(')[1].split(')')[0];
            let relativeTo: RelativeTo = {
                type: relativeToString.charAt(0) as RelativeToType,
                index: parseInt(relativeToString.slice(1))
            };

            translateTransform = {
                type: TransformType.TRANSLATE,
                relativeTo: relativeTo,
            }
        } else {
            throw new Error('Invalid translate transform');
        }

        return translateTransform as Transform;
    }

    isValidShapeSeed = (shapeSeed): boolean => {
        if (
            shapeSeed.count('(') != shapeSeed.count(')') ||
            shapeSeed.count('[') != shapeSeed.count(']') ||
            shapeSeed.count('{') != shapeSeed.count('}')
        )
            return false;

        return true;
    }

    parseGameOfLifeRule = (golRule: string): GameOfLifeRule => {
        let rule: GameOfLifeRule = {
            birth: [],
            survival: [],
            generations: 1,
            neighborhood: GOLNeighborhood.MOORE,
            range: 1,
        };

        let pieces = golRule.split('/');
        if (pieces.length == 1) {
            pieces = golRule.split(',');
        }

        for (let i = 0; i < pieces.length; i++) {
            if (pieces[i].startsWith('B')) {
                if (pieces[i].slice(1).includes('-')) {
                    let [min, max] = pieces[i].slice(1).split('-').map(Number);
                    rule.birth = {
                        min: min,
                        max: max
                    }
                } else {
                    rule.birth = pieces[i].slice(1).split('').map(Number);
                }
            } else if (pieces[i].startsWith('S')) {
                if (pieces[i].slice(1).includes('-')) {
                    let [min, max] = pieces[i].slice(1).split('-').map(Number);
                    rule.survival = {
                        min: min,
                        max: max
                    }
                } else {
                    rule.survival = pieces[i].slice(1).split('').map(Number);
                }
            } else if (pieces[i].startsWith('G') || pieces[i].startsWith('C')) {
                rule.generations = parseInt(pieces[i].slice(1));
            } else if (pieces[i].startsWith('N')) {
                rule.neighborhood = pieces[i].slice(1) == 'n' ? GOLNeighborhood.VON_NEUMANN : GOLNeighborhood.MOORE;
            } else if (pieces[i].startsWith('R')) {
                rule.range = parseInt(pieces[i].slice(1)) || 1;
            }
        }

        return rule;
    }
}