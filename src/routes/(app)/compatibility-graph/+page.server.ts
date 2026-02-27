import fs from 'fs';
import path from 'path';

const VCS_PATH = path.join(process.cwd(), 'src/lib/classes/algorithm/vcs.json');
const COMPATIBILITY_GRAPH_PATH = path.join(process.cwd(), 'src/lib/classes/algorithm/compatibilityGraph.json');

export async function load() {
    let allVCNames: string[] = [];
    let adjacencyListData: Record<string, string[]> = {};

    try {
        if (fs.existsSync(VCS_PATH)) {
            const raw = fs.readFileSync(VCS_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                allVCNames = parsed;
            }
        }
    } catch {
        // Return empty on error
    }

    try {
        if (fs.existsSync(COMPATIBILITY_GRAPH_PATH)) {
            const raw = fs.readFileSync(COMPATIBILITY_GRAPH_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                adjacencyListData = parsed;
            }
        }
    } catch {
        // Return empty on error
    }

    return { allVCNames, adjacencyListData };
}
