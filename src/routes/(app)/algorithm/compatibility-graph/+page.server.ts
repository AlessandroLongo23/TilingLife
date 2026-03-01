export async function load() {
    let allVCNames: string[] = [];
    let adjacencyListData: Record<string, string[]> = {};

    try {
        const mod = await import('$lib/data/vcs.json');
        const data = mod.default;
        if (Array.isArray(data)) allVCNames = data;
    } catch {
        // Return empty if file missing or invalid
    }

    try {
        const mod = await import('$lib/data/compatibilityGraph.json');
        const data = mod.default;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            adjacencyListData = data;
        }
    } catch {
        // Return empty if file missing or invalid
    }

    return { allVCNames, adjacencyListData };
}
