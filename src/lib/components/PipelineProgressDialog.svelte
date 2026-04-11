<script lang="ts">
	import { pipelineProgress, closePipelineProgress } from '$stores';
	import { Loader2, X, CheckCircle2 } from 'lucide-svelte';

	let progress = $derived($pipelineProgress.progress);
	let message = $derived($pipelineProgress.message);
	let canClose = $derived($pipelineProgress.canClose);
	let isOpen = $derived($pipelineProgress.isOpen);
	let title = $derived($pipelineProgress.title);

	function handleBackdropClick() {
		if (canClose) closePipelineProgress();
	}

	function handleClose() {
		if (canClose) closePipelineProgress();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && canClose) closePipelineProgress();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="progress-dialog-title"
		aria-describedby="progress-dialog-message"
	>
		<button
			class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity {canClose ? 'cursor-pointer' : 'cursor-default'}"
			onclick={handleBackdropClick}
			aria-label="Close dialog"
		></button>
		<div
			class="relative bg-zinc-800 border border-zinc-700/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden progress-dialog-content"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-zinc-700/50">
				<div class="flex items-center gap-3">
					{#if progress === 100 && canClose}
						<CheckCircle2 size={22} class="text-green-500 shrink-0" />
					{:else}
						<Loader2 size={22} class="text-green-500/90 animate-spin shrink-0" />
					{/if}
					<h2 id="progress-dialog-title" class="text-lg font-medium text-white">
						{title}
					</h2>
				</div>
				{#if canClose}
					<button
						class="p-1.5 rounded-md hover:bg-zinc-700/70 transition-colors text-zinc-400 hover:text-white"
						onclick={handleClose}
						aria-label="Close"
					>
						<X size={18} />
					</button>
				{/if}
			</div>

			<!-- Body -->
			<div class="px-5 py-5 space-y-4">
				<p
					id="progress-dialog-message"
					class="text-sm text-zinc-300 font-mono leading-relaxed min-h-[2.5rem]"
				>
					{message || 'Starting…'}
				</p>

				<!-- Progress bar -->
				<div class="h-2 rounded-full bg-zinc-700/60 overflow-hidden">
					{#if progress !== null}
						<div
							class="h-full bg-gradient-to-r from-green-600 to-green-500 rounded-full transition-all duration-300 ease-out"
							style="width: {Math.min(100, Math.max(0, progress))}%"
						></div>
					{:else}
						<div
							class="progress-bar-indeterminate h-full bg-gradient-to-r from-green-600 to-green-500 rounded-full"
						></div>
					{/if}
				</div>

				{#if progress !== null && progress < 100 && !canClose}
					<p class="text-xs text-zinc-500 tabular-nums">
						{Math.round(progress)}%
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.progress-dialog-content {
		animation: progressDialogIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes progressDialogIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.progress-bar-indeterminate {
		animation: progressIndeterminate 1.5s ease-in-out infinite;
		width: 40%;
		margin-left: -20%;
	}

	@keyframes progressIndeterminate {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(350%);
		}
		100% {
			transform: translateX(-100%);
		}
	}
</style>
