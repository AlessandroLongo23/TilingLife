export async function load() {
    let allPolygonNames: string[] = [];
    try {
        const mod = await import('$lib/classes/algorithm/polygons.json');
        const data = mod.default;
        if (Array.isArray(data)) allPolygonNames = data;
    } catch {
        // Return empty array if file missing or invalid
    }
    return { allPolygonNames };
}
