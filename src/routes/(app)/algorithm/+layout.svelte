<script lang="ts">
	import { page } from '$app/stores';
	import { BookOpen, Hexagon, Grid2x2, GitFork, Puzzle, Grid3x3 } from 'lucide-svelte';
	import { headerStore } from '$stores';
	import ScreenshotPreviewModal from '$components/ScreenshotPreviewModal.svelte';

	let { children } = $props();

	const ROUTE_TITLES: Record<string, { title: string; icon: typeof Hexagon }> = {
		'/algorithm/theory': { title: 'Theory', icon: BookOpen },
		'/algorithm/polygons-collection': { title: 'Polygon Collection', icon: Hexagon },
		'/algorithm/vertex-configurations': { title: 'Vertex Configurations', icon: Grid2x2 },
		'/algorithm/compatibility-graph': { title: 'Compatibility Graph', icon: GitFork },
		'/algorithm/seed-configurations': { title: 'Seed Configurations', icon: Puzzle },
		'/algorithm/tilings': { title: 'Tilings', icon: Grid3x3 },
	};

	const navItems = [
		{ href: '/algorithm/theory', label: 'Theory', icon: BookOpen },
		{ href: '/algorithm/polygons-collection', label: 'Polygons', icon: Hexagon },
		{ href: '/algorithm/vertex-configurations', label: 'Vertex Configs', icon: Grid2x2 },
		{ href: '/algorithm/compatibility-graph', label: 'Compat. Graph', icon: GitFork },
		{ href: '/algorithm/seed-configurations', label: 'Seed Configs', icon: Puzzle },
		{ href: '/algorithm/tilings', label: 'Tilings', icon: Grid3x3 }
	];

	let displayTitle = $derived(
		$headerStore.title || ROUTE_TITLES[$page.url.pathname]?.title || 'TilingLife'
	);
	let displayIcon = $derived(ROUTE_TITLES[$page.url.pathname]?.icon ?? Puzzle);
	let displayBadge = $derived($headerStore.badge);
	let displaySubtitle = $derived($headerStore.subtitle);
</script>

<div class="min-h-screen bg-zinc-900 text-white flex flex-col">
	<!-- Header -->
	<div class="border-b border-zinc-800 bg-zinc-900 backdrop-blur-sm sticky top-0 z-20 shrink-0">
		<div class="max-w-[1600px] mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					{#if displayIcon}
						{@const IconComponent = displayIcon}
						<IconComponent size={20} />
					{/if}
					<h1 class="text-lg font-semibold text-white/90">{displayTitle}</h1>
					{#if displayBadge}
						<span class="count-badge">{displayBadge}</span>
					{/if}
				</div>
				<nav class="flex items-center gap-1">
					{#each navItems as item}
						{@const NavIcon = item.icon}
						<a
							href={item.href}
							class="nav-link {$page.url.pathname === item.href ? 'nav-link-active' : ''}"
						>
							<NavIcon size={14} />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
			</div>
			{#if displaySubtitle}
				<p class="mt-1.5 text-xs text-zinc-600">{displaySubtitle}</p>
			{/if}
		</div>
	</div>

	<div class="flex-1 flex flex-col min-w-0">
		{@render children()}
	</div>
	<ScreenshotPreviewModal />
</div>

<style>
	.count-badge {
		font-size: 0.7rem;
		color: rgba(74, 222, 128, 0.9);
		padding: 0.1rem 0.5rem;
		border-radius: 1rem;
		background-color: rgba(74, 222, 128, 0.1);
		font-weight: 500;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: rgba(161, 161, 170, 1);
		transition: all 0.15s ease;
		border: 1px solid transparent;
	}

	.nav-link:hover {
		color: rgba(228, 228, 231, 1);
		background-color: rgba(63, 63, 70, 0.3);
	}

	.nav-link-active {
		color: rgba(74, 222, 128, 0.9);
		background-color: rgba(74, 222, 128, 0.08);
		border-color: rgba(74, 222, 128, 0.15);
	}

	.nav-link-active:hover {
		color: rgba(74, 222, 128, 1);
		background-color: rgba(74, 222, 128, 0.12);
	}
</style>
