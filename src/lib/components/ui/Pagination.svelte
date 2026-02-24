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

	let focused = $state(false);
	let inputValue = $state('');

	function submitPage() {
		const page = parseInt(inputValue, 10);
		if (!Number.isNaN(page)) goto(page);
		inputValue = '';
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitPage();
			e.currentTarget?.blur();
		}
	}
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

			<span class="pg-page-of">
				<label for="pagination-page-input" class="sr-only">Page number</label>
				<input
					id="pagination-page-input"
					type="number"
					min={1}
					max={totalPages}
					class="pg-input"
					value={focused ? inputValue : currentPage}
					onfocus={() => { focused = true; inputValue = String(currentPage); }}
					onblur={() => { submitPage(); focused = false; }}
					oninput={(e) => { inputValue = e.currentTarget.value; }}
					onkeydown={handleKeydown}
					aria-label="Current page"
				/>
				<span class="pg-of">of {totalPages}</span>
			</span>

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

	.pg-page-of {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0 0.25rem;
	}

	.pg-input {
		width: 2.5rem;
		height: 1.75rem;
		padding: 0 0.25rem;
		border-radius: 0.375rem;
		border: 1px solid rgba(63, 63, 70, 0.4);
		background-color: rgba(39, 39, 42, 0.5);
		color: rgba(228, 228, 231, 1);
		font-size: 0.75rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		text-align: center;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.pg-input:hover {
		background-color: rgba(63, 63, 70, 0.5);
	}

	.pg-input:focus {
		outline: none;
		border-color: rgba(74, 222, 128, 0.4);
		background-color: rgba(39, 39, 42, 0.8);
	}

	.pg-input::-webkit-outer-spin-button,
	.pg-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.pg-input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.pg-of {
		color: rgba(113, 113, 122, 0.8);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
