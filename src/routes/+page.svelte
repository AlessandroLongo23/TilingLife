<script>
    import { golRule, tilingRule, isDual, transformSteps, side, showConstructionPoints, showInfo, speed, activeTab } from '$lib/stores/configuration';
    import { onMount } from 'svelte';

    import Sidebar from '$lib/components/Sidebar.svelte';
    import Canvas from '$lib/components/Canvas.svelte';

    let sidebarElement = $state('');
    let sidebarWidth = $state(320);
    let isSidebarOpen = $state(true);
    let prevSidebarState = $state(true);
    
    let width = $state(600);
    let height = $state(600);
    let isResizing = $state(false);

    onMount(() => {
        updateDimensions();
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    let showGameOfLife = $derived($activeTab == "Game of Life");

    // Track sidebar state changes
    $effect(() => {
        if (prevSidebarState !== isSidebarOpen) {
            prevSidebarState = isSidebarOpen;
            
            // Use appropriate delay based on whether sidebar is opening or closing
            const delay = isSidebarOpen ? 300 : 10; // Longer delay for opening
            
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
        
        // Calculate correct sidebar width based on open/closed state
        sidebarWidth = isSidebarOpen ? sidebarElement.clientWidth : 48; // Width when closed is 48px (w-12)
        
        // Immediately update canvas dimensions
        width = window.innerWidth - sidebarWidth;
        height = window.innerHeight;
    }
</script>

<div class="flex h-screen w-full bg-zinc-900 overflow-hidden">
    <Sidebar bind:sidebarElement={sidebarElement} bind:isSidebarOpen={isSidebarOpen}/>
        
    <div 
        class="absolute top-0 right-0 bottom-0 transition-all duration-300 z-0 bg-zinc-900 overflow-hidden"
        style="left: {sidebarWidth}px;"
    >
        <Canvas 
            width={width}
            height={height} 
            golRule={$golRule} 
            tilingRule={$tilingRule} 
            isDual={$isDual}
            transformSteps={$transformSteps} 
            side={$side} 
            showConstructionPoints={$showConstructionPoints} 
            showGameOfLife={showGameOfLife}
            showInfo={$showInfo}
            speed={$speed}
        />
    </div>
</div>
