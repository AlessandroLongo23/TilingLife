<script>
    import Canvas from '$lib/components/Canvas.svelte';

    let rule = $state('B3/S23');
    let tiling = $state('3/m30/r(h1)');
    let transform_steps = $state(0);
    let side = $state(50);
    let show_construction_points = $state(false);
    let show_game_of_life = $state(false);
    let show_info = $state(false);

    let width = $state(600);
    let height = $state(600);
</script>

<div class="flex flex-row items-center justify-center h-full">
    <div class="flex flex-col items-center justify-center">
        <input type="text" bind:value={rule} />
        <input type="text" bind:value={tiling} />
        <input type="number" bind:value={transform_steps} />
        <input type="number" bind:value={side} />
        <input type="checkbox" bind:checked={show_construction_points} />
        <input type="checkbox" bind:checked={show_game_of_life} />
        <input type="checkbox" bind:checked={show_info} />
    </div>

    <Canvas 
        width={width}
        height={height} 
        rule={rule} 
        tiling={tiling} 
        transform_steps={transform_steps} 
        side={side} 
        show_construction_points={show_construction_points} 
        show_game_of_life={show_game_of_life}
        show_info={show_info}
    />
</div>
