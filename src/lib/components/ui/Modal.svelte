<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { X } from 'lucide-svelte';
    
    let { 
        isOpen = $bindable(false),
        title = $bindable(""),
        maxWidth = $bindable("max-w-4xl"),
        showHeader = $bindable(true),
    } = $props();
    
    const dispatch = createEventDispatcher();
    
    const handleKeydown = (e) => {
        if (e.key === 'Escape' && isOpen) {
            close();
        }
    };
    
    const close = () => {
        isOpen = false;
        dispatch('close');
    };
    
    onMount(() => {
        document.addEventListener('keydown', handleKeydown);
        return () => {
            document.removeEventListener('keydown', handleKeydown);
        };
    });
    
    const handleModalClick = (e) => {
        e.stopPropagation();
    };
</script>

<style>
    @keyframes bounceIn {
        0% {
            opacity: 0;
            transform: scale(0.8);
        }
        60% {
            opacity: 1;
            transform: scale(1.03);
        }
        80% {
            transform: scale(0.97);
        }
        100% {
            transform: scale(1);
        }
    }
    
    .modal-content {
        animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55); /* Bounce effect */
    }
    
    .backdrop {
        animation: fadeIn 0.2s ease-out forwards;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>

{#if isOpen}
    <div 
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto p-4 backdrop"
        onclick={close}
        onkeydown={handleKeydown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
        <div 
            class="bg-zinc-800 border border-zinc-700/50 rounded-lg shadow-xl {maxWidth} w-full modal-content"
            onclick={handleModalClick}
            onkeydown={() => {}}
            role="document"
        >
            {#if showHeader}
                <div class="flex items-center justify-between p-4 border-b border-zinc-700/50">
                    <h2 id="modal-title" class="text-lg font-medium text-white">{title}</h2>
                    <div class="flex items-center gap-2">
                        <slot name="header" />
                        <button 
                            class="p-1 rounded-md hover:bg-zinc-700/70 transition-all text-white/80 hover:text-white/100"
                            onclick={close}
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            {/if}
            
            <div class="">
                <slot />
            </div>
        </div>
    </div>
{/if} 