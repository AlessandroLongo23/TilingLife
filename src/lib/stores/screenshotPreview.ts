import { writable } from 'svelte/store';

export interface ScreenshotPreviewState {
    imageDataUrl: string | null;
    filename: string;
    rulestring: string;
    groupId: string | null;
}

const initialState: ScreenshotPreviewState = {
    imageDataUrl: null,
    filename: '',
    rulestring: '',
    groupId: null
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
