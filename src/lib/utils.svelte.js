import { birth, survive } from '$lib/stores.svelte.js';
import { get } from 'svelte/store';

export class Grid {
    cells = $state([]);

    constructor(size) {
        this.size = size
        this.cells = Array.from({ length: this.size }, () => Array.from({ length: this.size }, () => new Cell()));
    }

    update() {
        for (let i = 0; i < this.cells.length; i++)
            for (let j = 0; j < this.cells[i].length; j++)
                this.udpateNeighbouringCells(i, j);

        for (let i = 0; i < this.cells.length; i++)
            for (let j = 0; j < this.cells[i].length; j++)
                this.cells[i][j].update();
    }

    udpateNeighbouringCells(i, j) {
        for (let x = -1; x <= 1; x++) 
            for (let y = -1; y <= 1; y++)
                if (
                    this.cells[i][j].state == 1 &&
                    (x !== 0 || y !== 0) && 
                    (i + x >= 0 && i + x < this.cells.length && j + y >= 0 && j + y < this.cells.length)
                )
                    this.cells[i + x][j + y].aliveNeighbours++;
    }

    random() {
        for (let i = 0; i < this.cells.length; i++) {
            for (let j = 0; j < this.cells[i].length; j++) {
                this.cells[i][j].state = Math.random() > 0.5 ? 1 : 0;
                this.cells[i][j].aliveNeighbours = 0;
            }
        }
    }

    clear() {
        for (let i = 0; i < this.cells.length; i++) {
            for (let j = 0; j < this.cells[i].length; j++) {
                this.cells[i][j].state = 0;
                this.cells[i][j].aliveNeighbours = 0;
            }
        }
    }
}

class Cell {
    state = $state();

    constructor() {
        this.state = Math.random() > 0.5 ? 1 : 0;
        this.aliveNeighbours = 0;
    }

    update() {
        this.state = (
            (this.state === 0 && get(birth).includes(this.aliveNeighbours.toString())) || 
            (this.state === 1 && get(survive).includes(this.aliveNeighbours.toString()))
        ) == true ? 1 : 0;

        this.aliveNeighbours = 0;
    }
}
