<script>
	let { 
		title = "Sidebar", 
		isOpen = true,
		children 
	} = $props();
	
	function toggleSidebar() {
		isOpen = !isOpen;
	}
</script>

<div class="h-full fixed left-0 top-0 transition-all duration-300 flex flex-col" class:w-80={isOpen} class:w-12={!isOpen}>
	<div class="bg-zinc-800 text-white h-full overflow-hidden flex flex-col">
		<div class="p-4 flex items-center justify-between border-b border-zinc-700 flex-shrink-0">
			{#if isOpen}
				<h2 class="text-lg font-semibold text-white">{title}</h2>
			{/if}
			<button
				onclick={toggleSidebar}
				class="p-1 rounded-md hover:bg-zinc-700 transition-colors text-white"
				aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="transition-transform"
					class:rotate-180={!isOpen}
				>
					{#if isOpen}
						<path d="M15 18l-6-6 6-6" />
					{:else}
						<path d="M9 18l6-6-6-6" />
					{/if}
				</svg>
			</button>
		</div>
		
		{#if isOpen}
			<div class="flex-1 overflow-y-auto">
				{@render children()}
			</div>
		{/if}
	</div>
</div> 