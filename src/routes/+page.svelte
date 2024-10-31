<script>
    import { onMount } from "svelte";

    class Grid {
        cells = $state([]);

        constructor(size) {
            this.cells = Array.from({ length: size }, () => Array.from({ length: size }, () => new Cell()));
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
    }

    class Cell {
        state = $state();

        constructor() {
            this.state = Math.random() > 0.5 ? 1 : 0;
            this.aliveNeighbours = 0;
        }

        update() {
            if (
                (this.state === 1 && (this.aliveNeighbours === 2 || this.aliveNeighbours === 3)) || 
                (this.state === 0 && this.aliveNeighbours === 3)
            )
                this.state = 1;
            else
                this.state = 0;

            this.aliveNeighbours = 0;
        }
    }

    let grid = $state(new Grid(50));

    setInterval(() => {
        if (grid)
            grid.update();
    }, 16);
</script>

<div>
    <h1>Game of Life</h1>

    <!-- grid -->
    <div>
        {#each grid.cells as row}
            <div class="flex flex-rpw">
                {#each row as cell}
                    <div class="flex flex-col text-xl {cell.state === 1 ? 'bg-black' : 'bg-white'}" style="width: 10px; height: 10px;">
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
</style>