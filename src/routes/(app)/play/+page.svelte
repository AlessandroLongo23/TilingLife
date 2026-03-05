<script>
    import { speed, activeTab, ActiveTab } from '$stores';
    import { onMount } from 'svelte';
    import { contentService } from '$services/contentService';

    import Sidebar from '$components/Sidebar.svelte';
    import Canvas from '$components/Canvas.svelte';
    import TheoryContent from '$components/TheoryContent.svelte';
    import TilingModalContent from '$components/TilingModalContent.svelte';
    import ScreenshotPreviewModal from '$components/ScreenshotPreviewModal.svelte';

    let sidebarElement = $state('');
    let isSidebarOpen = $state(true);
    
    let targetTheorySection = $state('');
    let activeTheorySection = $state('');
    
    const SIDEBAR_WIDTH = 384;
    
    let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
    let windowHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
    
    let canvasOffset = $derived(isSidebarOpen ? SIDEBAR_WIDTH / 2 : 0);

    onMount(() => {
        contentService.loadContent('/theory/tilings-and-automata.md');
        
        windowWidth = window.innerWidth;
        windowHeight = window.innerHeight;
        
        const handleResize = () => {
            windowWidth = window.innerWidth;
            windowHeight = window.innerHeight;
        };
        
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    let showGameOfLife = $derived($activeTab === ActiveTab.GAME_OF_LIFE);
    let showTheory = $derived($activeTab === ActiveTab.THEORY);
    let showCanvas = $derived(!showTheory);

    const handleSectionSelect = (sectionId) => {
        targetTheorySection = sectionId;
    };
    
    const handleActiveSectionChange = (e) => {
        activeTheorySection = e.detail.sectionId;
    };
</script>

<div class="flex-1 min-h-0 w-full bg-zinc-900 overflow-hidden relative">
    <div
        class="absolute inset-0 z-0 transition-transform duration-300 ease-in-out"
        style="transform: translateX({canvasOffset}px);"
    >
        {#if showCanvas}
            <Canvas
                width={windowWidth}
                height={windowHeight} 
                showGameOfLife={showGameOfLife}
                speed={$speed}
                isSidebarOpen={isSidebarOpen}
            />
        {:else if showTheory}
            <TheoryContent 
                targetSection={targetTheorySection} 
                on:activeSection={handleActiveSectionChange}
            />
        {/if}
    </div>
    
    <Sidebar 
        bind:sidebarElement={sidebarElement} 
        bind:isSidebarOpen={isSidebarOpen}
        onSectionSelect={handleSectionSelect}
        activeTheorySection={activeTheorySection}
    />
    
    <TilingModalContent />
    <ScreenshotPreviewModal />
</div>