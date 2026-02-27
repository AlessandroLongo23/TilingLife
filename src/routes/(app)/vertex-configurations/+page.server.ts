import fs from 'fs';
import path from 'path';

const VCS_PATH = path.join(process.cwd(), 'src/lib/classes/algorithm/vcs.json');

export async function load() {
    let allVCNames: string[] = [];
    try {
        if (fs.existsSync(VCS_PATH)) {
            const raw = fs.readFileSync(VCS_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                allVCNames = parsed;
            }
        }
    } catch {
        // Return empty array on any error
    }
    return { allVCNames };
}
