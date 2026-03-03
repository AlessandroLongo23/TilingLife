<script>
    import { screenshotPreview, screenshotPreviewModalOpen, closeScreenshotPreview } from '$stores';
    import { uploadTilingScreenshot, dataUrlToWebPBlob } from '$services/tilingImages';
    import Modal from '$components/ui/Modal.svelte';
    import { Download, CloudUpload, Loader2 } from 'lucide-svelte';

    let imageDataUrl = $derived($screenshotPreview.imageDataUrl);
    let filename = $derived($screenshotPreview.filename);
    let rulestring = $derived($screenshotPreview.rulestring);
    let groupId = $derived($screenshotPreview.groupId);
    let allowSupabaseUpload = $derived($screenshotPreview.allowSupabaseUpload ?? false);

    let savingLocal = $state(false);
    let savingSupabase = $state(false);
    let supabaseError = $state(null);

    async function handleSaveLocally() {
        if (!imageDataUrl) return;
        savingLocal = true;
        try {
            const link = document.createElement('a');
            link.href = imageDataUrl;
            link.download = filename;
            link.click();
        } finally {
            savingLocal = false;
            closeScreenshotPreview();
        }
    }

    async function handleSaveToSupabase() {
        if (!imageDataUrl || !groupId) return;
        savingSupabase = true;
        supabaseError = null;
        try {
            const blob = await dataUrlToWebPBlob(imageDataUrl);
            const isDual = rulestring.includes('*');
            const result = await uploadTilingScreenshot(rulestring, groupId, blob, isDual);
            if (result.success) {
                closeScreenshotPreview();
            } else {
                supabaseError = result.error ?? 'Upload failed';
            }
        } catch (err) {
            supabaseError = err instanceof Error ? err.message : 'Upload failed';
        } finally {
            savingSupabase = false;
        }
    }

    function handleClose() {
        if (!savingSupabase) {
            closeScreenshotPreview();
        }
    }
</script>

<Modal
    bind:isOpen={$screenshotPreviewModalOpen}
    title="Screenshot Preview"
    maxWidth="max-w-2xl"
    on:close={handleClose}
>
    <div class="p-4 space-y-4">
        <div class="flex justify-center bg-zinc-900/60 rounded-lg p-4 border border-zinc-700/50 min-h-[280px]">
            {#if imageDataUrl}
                <img
                    src={imageDataUrl}
                    alt="Screenshot preview"
                    class="max-w-full max-h-[320px] object-contain rounded-md"
                />
            {:else}
                <div class="flex items-center justify-center text-zinc-500">
                    <Loader2 size={32} class="animate-spin" />
                </div>
            {/if}
        </div>

        {#if supabaseError}
            <p class="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                {supabaseError}
            </p>
        {/if}

        <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button
                onclick={handleSaveLocally}
                disabled={savingLocal || !imageDataUrl}
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/60 text-white/90 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if savingLocal}
                    <Loader2 size={18} class="animate-spin" />
                    Saving…
                {:else}
                    <Download size={18} />
                    Save Locally
                {/if}
            </button>
            {#if allowSupabaseUpload}
                <button
                    onclick={handleSaveToSupabase}
                    disabled={savingSupabase || !imageDataUrl || !groupId}
                    title={!groupId ? 'This tiling is not in the database' : 'Replace the tiling image in Supabase storage'}
                    class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-zinc-700/50 bg-green-700/40 hover:bg-green-700/60 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {#if savingSupabase}
                        <Loader2 size={18} class="animate-spin" />
                        Uploading…
                    {:else}
                        <CloudUpload size={18} />
                        Save to Supabase
                    {/if}
                </button>
            {/if}
        </div>

        {#if allowSupabaseUpload && !groupId && imageDataUrl}
            <p class="text-xs text-zinc-500">
                "Save to Supabase" is only available for tilings in the database.
            </p>
        {/if}
    </div>
</Modal>
