<script>
    import { speed, activeTab } from '$lib/stores/configuration.js';
    import { onMount } from 'svelte';
    import { contentService } from '$lib/services/contentService';

    import Sidebar from '$lib/components/Sidebar.svelte';
    import Canvas from '$lib/components/Canvas.svelte';
    import TheoryContent from '$lib/components/TheoryContent.svelte';
    import TilingModalContent from '$lib/components/TilingModalContent.svelte';

    let sidebarElement = $state('');
    let sidebarWidth = $state(320);
    let isSidebarOpen = $state(true);
    let prevSidebarState = $state(true);
    
    let width = $state(600);
    let height = $state(600);
    let isResizing = $state(false);
    let targetTheorySection = $state('');
    let activeTheorySection = $state('');

    onMount(() => {
        updateDimensions();
        window.addEventListener('resize', handleResize);
        
        contentService.loadContent('/theory/tilings-and-automata.md');
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    let showGameOfLife = $derived($activeTab === "Game of Life");
    let showTheory = $derived($activeTab === "Theory");
    let showCanvas = $derived(!showTheory);

    const handleSectionSelect = (sectionId) => {
        targetTheorySection = sectionId;
    };
    
    const handleActiveSectionChange = (e) => {
        activeTheorySection = e.detail.sectionId;
    };

    $effect(() => {
        if (prevSidebarState !== isSidebarOpen) {
            prevSidebarState = isSidebarOpen;
            
            const delay = isSidebarOpen ? 300 : 10;
            
            setTimeout(() => {
                updateDimensions();
            }, delay);
        }
    });
    
    const handleResize = () => {
        if (!isResizing) {
            isResizing = true;
            setTimeout(() => {
                updateDimensions();
                isResizing = false;
            }, 100);
        }
    }
    
    const updateDimensions = () => {
        if (!sidebarElement) return;
        
        sidebarWidth = isSidebarOpen ? sidebarElement.clientWidth : 48;
        
        width = window.innerWidth - sidebarWidth;
        height = window.innerHeight;
    }
</script>

<div class="flex h-screen w-full bg-zinc-900 overflow-hidden">
    <Sidebar 
        bind:sidebarElement={sidebarElement} 
        bind:isSidebarOpen={isSidebarOpen}
        onSectionSelect={handleSectionSelect}
        activeTheorySection={activeTheorySection}
    />
        
    <div
        class="absolute top-0 right-0 bottom-0 transition-all duration-300 z-0 bg-zinc-900 overflow-hidden"
        style="left: {sidebarWidth}px;"
    >
        {#if showCanvas}
            <Canvas 
                width={width}
                height={height} 
                showGameOfLife={showGameOfLife}
                speed={$speed}
            />
        {:else if showTheory}
            <TheoryContent 
                targetSection={targetTheorySection} 
                on:activeSection={handleActiveSectionChange}
            />
        {/if}
    </div>
    
    <TilingModalContent />
</div>