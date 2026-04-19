<script>
    import { speed, activeTab, ActiveTab, uiVisible } from '$stores';
    import { onMount } from 'svelte';
    import { contentService } from '$services/contentService';

    import Sidebar from '$components/Sidebar.svelte';
    import Canvas from '$components/Canvas.svelte';
    import TheoryContent from '$components/TheoryContent.svelte';
    import TilingModalContent from '$components/TilingModalContent.svelte';
    import ScreenshotPreviewModal from '$components/ScreenshotPreviewModal.svelte';

    let sidebarElement = $state('');
    let isSidebarOpen = $state(true);
    let sidebarOpenBeforeHide = true;

    let targetTheorySection = $state('');
    let activeTheorySection = $state('');

    const SIDEBAR_WIDTH = 384;

    let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
    let windowHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);

    let sidebarGutter = $derived(isSidebarOpen ? SIDEBAR_WIDTH : 0);
    let canvasWidth = $derived(Math.max(0, windowWidth - sidebarGutter));

    onMount(() => {
        contentService.loadContent('/theory/tilings-and-automata.md');

        windowWidth = window.innerWidth;
        windowHeight = window.innerHeight;

        const handleResize = () => {
            windowWidth = window.innerWidth;
            windowHeight = window.innerHeight;
        };

        const handleKeyDown = (e) => {
            if (e.key !== 'h' && e.key !== 'H') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target;
            if (target instanceof HTMLElement) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
            }
            if ($uiVisible) {
                sidebarOpenBeforeHide = isSidebarOpen;
                isSidebarOpen = false;
                $uiVisible = false;
            } else {
                $uiVisible = true;
                isSidebarOpen = sidebarOpenBeforeHide;
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            $uiVisible = true;
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
        class="absolute inset-y-0 right-0 z-0 transition-[left] duration-300 ease-in-out"
        style="left: {sidebarGutter}px;"
    >
        {#if showCanvas}
            <Canvas
                width={canvasWidth}
                height={windowHeight}
                showGameOfLife={showGameOfLife}
                speed={$speed}
                isSidebarOpen={isSidebarOpen}
                showExtra={$uiVisible}
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