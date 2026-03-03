import { Polygon, Vector } from '$classes';
import { get } from 'svelte/store';
import { colorParams } from '$stores';
import { toDegrees } from '$lib/utils/geometry.svelte';

const PHI = (1 + Math.sqrt(5)) / 2;

export class DualPolygon extends Polygon {
    constructor(data) {
        super();
        this.centroid = data.centroid;
        this.vertices = data.vertices;
        this.halfways = data.halfways;

        this.calculateHue();
        this.calculateSides();
        this.calculateAngles();
    }

    calculateHue = () => {
        this.hue = this.calculateAnglesHash();
    }

    calculateAnglesHash() {
        let angles: number[] = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const prev = (i === 0) ? this.vertices.length - 1 : i - 1;
            const curr = i;
            const next = (i === this.vertices.length - 1) ? 0 : i + 1;
            
            const v1 = Vector.sub(this.vertices[prev], this.vertices[curr]);
            const v2 = Vector.sub(this.vertices[next], this.vertices[curr]);
            
            const mag1 = v1.mag();
            const mag2 = v2.mag();
            const dot = v1.dot(v2);
            
            const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
            angles.push(Math.round(angle)); 
        }

        let minRotation = [...angles]; 
        
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < angles.length; i++) {
                const rotation = [...angles.slice(i), ...angles.slice(0, i)];
                
                let isSmaller = false;
                for (let j = 0; j < angles.length; j++) {
                    if (rotation[j] < minRotation[j]) {
                        isSmaller = true;
                        break;
                    } else if (rotation[j] > minRotation[j]) {
                        break;
                    }
                }
                
                if (isSmaller)
                    minRotation = [...rotation];
            }

            angles = angles.reverse();
        }

        const params = get(colorParams);
        const a = params.a;
        const b = params.b;
        
        let hash = 0;
        for (let i = 0; i < minRotation.length; i++)
            hash = (hash * PHI + minRotation[i] * Math.sqrt(2)) % 1447;
        
        const baseHue = hash % 360;
        const rotatedHue = (baseHue + a) % 360;
        const displacedHue = rotatedHue + b * this.vertices.length * Math.sin(rotatedHue * Math.PI / 180);
        
        return (displacedHue + 360) % 360;
    }

    getName = (): string => {
        return `${this.vertices.length}[${this.sides.map(s => s.toFixed(3)).join(';')}](${this.angles.map(a => toDegrees(a)).join(';')})`;
    }

    clone = (): DualPolygon => {
        return new DualPolygon({
            centroid: this.centroid.copy(),
            vertices: [...this.vertices],
            halfways: [...this.halfways]
        });
    }
}