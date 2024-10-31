<script>
    import Button from "$lib/components/Button.svelte"

    let count = $state(0);
    let second_count = $derived(count > 3);

    let animals = ["cat", "dog", "mucca", "hyppopotamus"];

    function increase() {
        count++;
    }
</script>

<div>
    <h1>{count}</h1>
    <button onclick={increase}>vaiaiaiai</button>
    <ol>
        {#each animals as animal}
            <li>
                {animal}
            </li>
        {/each}
    </ol>
    <div>
        {#if count > 3}
            {second_count}
        {/if}
    </div>

    <Button content = {"prova"}/>
</div>

<style>
</style>