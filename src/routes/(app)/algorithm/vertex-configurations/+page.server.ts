export async function load() {
    let allVCNames: string[] = [];
    try {
        const mod = await import('$lib/data/vcs.json');
        const data = mod.default;
        if (Array.isArray(data)) allVCNames = data;
    } catch {
        // Return empty array if file missing or invalid
    }
    return { allVCNames };
}
