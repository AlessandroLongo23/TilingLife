<script>
    let {content, func} = $props();
</script>

<div>
    <button onclick={func} class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-4 rounded mt-4">
        {content}
    </button>
</div>