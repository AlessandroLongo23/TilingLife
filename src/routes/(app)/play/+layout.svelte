<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-zinc-900 text-white flex flex-col">
	{@render children()}
</div>