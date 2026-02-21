/// <reference types="@sveltejs/kit" />

declare module '$app/environment' {
	export const browser: boolean;
	export const building: boolean;
	export const dev: boolean;
	export const version: string;
}
