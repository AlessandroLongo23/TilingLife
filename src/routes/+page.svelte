<script>
    import { speed, selectedTiling } from '$lib/stores/configuration.js';
    import { tilingRules } from '$lib/stores/tilingRules.js';
    import { fade, fly } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    import Canvas from '$lib/components/Canvas.svelte';

    let ready = $state(false);
    let width = $state();
    let height = $state();

    onMount(() => {
        if (browser) {
            width = window.innerWidth;
            height = window.innerHeight;

            let tilings = tilingRules.flatMap(rule => rule.rules);
            selectedTiling.set(tilings[Math.floor(Math.random() * tilings.length)]);

            window.addEventListener('resize', () => {
                width = window.innerWidth;
                height = window.innerHeight;
            });

            setTimeout(() => {
                ready = true;
            }, 10);
        }
    });
</script>

<div class="w-full h-full">
    <Canvas 
        width={width}
        height={height} 
        showGameOfLife={true}
        speed={$speed}
        showExtra={false}
    />
</div>

<div class="absolute top-0 left-0 w-full h-full landing-overlay">
    {#if ready}
    <div class="w-full h-full flex items-center justify-center p-4">
        <div 
            class="relative max-w-md w-full rounded-lg overflow-hidden backdrop-blur-md shadow-xl border border-zinc-700/50 bg-zinc-800/40"
            in:fade={{ duration: 400, delay: 100 }}
        >
            <div class="absolute inset-0 bg-gradient-to-br from-zinc-800/50 via-zinc-900/50 to-black/50"></div>
            
            <div class="relative z-10 p-8 md:p-10">
                <div in:fly={{ y: -15, duration: 600, delay: 200 }}>
                    <h1 class="text-white/90 text-3xl md:text-4xl font-medium tracking-tight">
                        Welcome to <span class="font-bold text-green-400">Tiling Life</span>
                    </h1>
                </div>
                
                <div in:fly={{ y: 0, duration: 500, delay: 400 }}>
                    <p class="mt-3 text-zinc-300 text-sm md:text-base font-light">
                        Explore the beauty of cellular automata on a variety of interactive tiling patterns
                    </p>
                </div>
                
                <div in:fly={{ y: 10, x: 0, duration: 500, delay: 600 }} class="mt-8">
                    <a 
                        href="/practice"
                        class="w-full inline-flex items-center justify-center h-10 px-6 text-sm font-medium bg-green-700 hover:bg-green-800 active:bg-green-900 text-white rounded-md transition-all duration-200 ease-in-out"
                    >
                        Start Exploring
                    </a>
                </div>
            </div>
        </div>
    </div>
    {/if}
</div>

<style>
    .landing-overlay {
        transition: opacity 0.5s ease;
        background-color: rgba(0, 0, 0, 0.65);
    }
    
    .fade-out {
        opacity: 0;
    }
    
    :global(body) {
        background-color: #18181b;
        color: #f8fafc;
    }
    
    /* a {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    a:hover {
        box-shadow: 0 4px 12px hsla(128, 91%, 60%, 0.2);
    } */
</style>