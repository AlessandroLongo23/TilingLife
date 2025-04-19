<script>
	let {
		id,
		label,
		onclick = () => {}
	} = $props();
</script>

<button id={id} onclick={onclick} class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-2 rounded-md transition-all duration-100 ease-in-out">
	{label}
</button>

