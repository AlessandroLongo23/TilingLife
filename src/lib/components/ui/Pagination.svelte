<script>
	import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-svelte';

	let {
		totalItems = 0,
		pageSize = 24,
		currentPage = $bindable(1),
	} = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	function goto(page) {
		currentPage = Math.max(1, Math.min(totalPages, page));
	}

	let visiblePages = $derived.by(() => {
		const pages = [];
		const maxVisible = 7;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) pages.push(i);
			return pages;
		}

		pages.push(1);

		let start = Math.max(2, currentPage - 1);
		let end = Math.min(totalPages - 1, currentPage + 1);

		if (currentPage <= 3) {
			start = 2;
			end = Math.min(5, totalPages - 1);
		} else if (currentPage >= totalPages - 2) {
			start = Math.max(2, totalPages - 4);
			end = totalPages - 1;
		}

		if (start > 2) pages.push(null);
		for (let i = start; i <= end; i++) pages.push(i);
		if (end < totalPages - 1) pages.push(null);

		pages.push(totalPages);
		return pages;
	});

	let startItem = $derived((currentPage - 1) * pageSize + 1);
	let endItem = $derived(Math.min(currentPage * pageSize, totalItems));
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between gap-4 select-none">
		<span class="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
			{startItem}–{endItem} of {totalItems}
		</span>

		<div class="flex items-center gap-1">
			<button
				class="pg-btn"
				onclick={() => goto(1)}
				disabled={currentPage <= 1}
				aria-label="First page"
			>
				<ChevronsLeft size={14} />
			</button>
			<button
				class="pg-btn"
				onclick={() => goto(currentPage - 1)}
				disabled={currentPage <= 1}
				aria-label="Previous page"
			>
				<ChevronLeft size={14} />
			</button>

			{#each visiblePages as p}
				{#if p === null}
					<span class="pg-ellipsis">&hellip;</span>
				{:else}
					<button
						class="pg-num {currentPage === p ? 'pg-active' : ''}"
						onclick={() => goto(p)}
						aria-current={currentPage === p ? 'page' : undefined}
					>
						{p}
					</button>
				{/if}
			{/each}

			<button
				class="pg-btn"
				onclick={() => goto(currentPage + 1)}
				disabled={currentPage >= totalPages}
				aria-label="Next page"
			>
				<ChevronRight size={14} />
			</button>
			<button
				class="pg-btn"
				onclick={() => goto(totalPages)}
				disabled={currentPage >= totalPages}
				aria-label="Last page"
			>
				<ChevronsRight size={14} />
			</button>
		</div>
	</div>
{/if}

<style>
	.pg-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.375rem;
		border: 1px solid rgba(63, 63, 70, 0.4);
		background-color: rgba(39, 39, 42, 0.5);
		color: rgba(161, 161, 170, 1);
		transition: all 0.15s ease;
	}

	.pg-btn:hover:not(:disabled) {
		background-color: rgba(63, 63, 70, 0.5);
		color: rgba(228, 228, 231, 1);
	}

	.pg-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.pg-num {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		height: 1.75rem;
		padding: 0 0.25rem;
		border-radius: 0.375rem;
		border: 1px solid rgba(63, 63, 70, 0.4);
		background-color: rgba(39, 39, 42, 0.5);
		color: rgba(161, 161, 170, 1);
		font-size: 0.75rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		transition: all 0.15s ease;
	}

	.pg-num:hover {
		background-color: rgba(63, 63, 70, 0.5);
		color: rgba(228, 228, 231, 1);
	}

	.pg-active {
		background-color: rgba(74, 222, 128, 0.12);
		color: rgba(74, 222, 128, 0.9);
		border-color: rgba(74, 222, 128, 0.25);
	}

	.pg-active:hover {
		background-color: rgba(74, 222, 128, 0.2);
		color: rgba(74, 222, 128, 1);
	}

	.pg-ellipsis {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.75rem;
		color: rgba(113, 113, 122, 0.6);
		font-size: 0.75rem;
		pointer-events: none;
	}
</style>
