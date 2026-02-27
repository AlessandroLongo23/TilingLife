import fs from 'fs';
import path from 'path';

const POLYGONS_PATH = path.join(process.cwd(), 'src/lib/classes/algorithm/polygons.json');

export async function load() {
    let allPolygonNames: string[] = [];
    try {
        if (fs.existsSync(POLYGONS_PATH)) {
            const raw = fs.readFileSync(POLYGONS_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                allPolygonNames = parsed;
            }
        }
    } catch {
        // Return empty array on any error
    }
    return { allPolygonNames };
}
