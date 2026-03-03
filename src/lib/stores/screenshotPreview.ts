import { writable } from 'svelte/store';

export interface ScreenshotPreviewState {
    imageDataUrl: string | null;
    filename: string;
    rulestring: string;
    groupId: string | null;
    /** When true, shows the "Save to Supabase" option. Defaults to false for algorithm cards. */
    allowSupabaseUpload?: boolean;
}

const initialState: ScreenshotPreviewState = {
    imageDataUrl: null,
    filename: '',
    rulestring: '',
    groupId: null,
    allowSupabaseUpload: false
};

export const screenshotPreview = writable<ScreenshotPreviewState>(initialState);

/** Bindable store for Modal open state - use with bind:isOpen */
export const screenshotPreviewModalOpen = writable(false);

export function openScreenshotPreview(data: ScreenshotPreviewState) {
    screenshotPreview.set(data);
    screenshotPreviewModalOpen.set(true);
}

export function closeScreenshotPreview() {
    screenshotPreviewModalOpen.set(false);
    screenshotPreview.set(initialState);
}
