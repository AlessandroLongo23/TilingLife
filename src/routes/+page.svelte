<script>
    import { onMount } from "svelte";
    // import { Grid } from "$lib/utils.svelte";
    // import { birth, survive } from "$lib/stores.svelte";

    class Grid {
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

        reset() {
            for (let i = 0; i < this.cells.length; i++) {
                for (let j = 0; j < this.cells[i].length; j++) {
                    this.cells[i][j].state = Math.random() > 0.5 ? 1 : 0;
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
            if (
                (this.state === 0 && birth.includes(this.aliveNeighbours.toString())) || 
                (this.state === 1 && survive.includes(this.aliveNeighbours.toString()))
            )
                this.state = 1;
            else
                this.state = 0;

            this.aliveNeighbours = 0;
        }
    }

    let birth = $state('3');
    let survive = $state('23');

    let grid = $state(new Grid(50));

    setInterval(() => {
        if (grid)
            grid.update();
    }, 160);
</script>

<div class="flex flex-col items-center justify-center m-auto h-screen">
    <h1 class="text-4xl font-bold mb-4">Game of Life</h1>
    <h3 class="text-xl font-bold mb-4">Rulestring:
        B<input bind:value={birth} class="w-16 border border-black mx-2 rounded px-2" type="text">/
        S<input bind:value={survive} class="w-16 border border-black ms-2 rounded px-2" type="text">
    </h3>

    <div class="border-4 border-black">
        {#each grid.cells as row}
            <div class="flex flex-rpw">
                {#each row as cell}
                    <div onclick={() => {cell.state = 1}} class="flex flex-col text-xl border border-neutral-500/10 {cell.state === 1 ? 'bg-black' : 'bg-white'}" style="width: 10px; height: 10px;">
                    </div>
                {/each}
            </div>
        {/each}
    </div>

    <button onclick={() => grid.reset()} class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-4 rounded mt-4">Reset</button>
</div>

<style>
</style>