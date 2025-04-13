<script>
    import { birth, survive } from "$lib/stores.svelte.js";
    import { Grid } from "$lib/utils.svelte.js";
    
    import Button from "$lib/components/Button.svelte";

    let isPlaying = $state(true);
    let shape = $state('square');

    let grid = $state(new Grid(50));

    setInterval(() => {
        if (grid && isPlaying)
            grid.update();
    }, 100);
</script>

<div class="flex flex-col items-center justify-center m-auto h-screen">
    <h1 class="text-4xl font-bold mb-4">Game of Life</h1>
    <h3 class="text-xl font-bold mb-4">Rulestring:
        B<input bind:value={$birth} class="w-16 border border-black mx-2 rounded px-2" type="text">/
        S<input bind:value={$survive} class="w-16 border border-black ms-2 rounded px-2" type="text">
    </h3>

    <div class="border-4 border-black">
        {#each grid.cells as row}
            <div class="flex flex-rpw">
                {#each row as cell}
                    <button onclick={() => {cell.state = 1 - cell.state}} class="flex flex-col text-xl bg-black" aria-label="cell">
                        <div class="{cell.state === 1 ? 'bg-orange-600' : 'bg-white'} {shape === "square" ? 'rounded-sm' : 'rounded-full'}" style="width: 12px; height: 12px;"></div>
                    </button>
                {/each}
            </div>
        {/each}
    </div>

    <div class="flex flex-row justify-center items-center gap-4">
        <Button content="Clear" func={() => grid.clear()}/>
        <Button content="Random" func={() => grid.random()}/>
        <Button content={isPlaying ? 'Pause' : 'Play'} func={() => isPlaying = !isPlaying}/>
        <Button content="Next" func={() => grid.update($birth, $survive)}/>
        <Button content={shape} func={() => shape = shape === 'square' ? 'circle' : 'square'}/>
    </div>

    <a href="/tilings">Tilings</a>
</div>