import fs from 'fs';
import path from 'path';

const BASE_DIR = 'src/lib/classes/algorithm/seedConfigurations';
const PAGE_SIZE = 24;

let dataCache: Map<string, any[]> = new Map();

function getCacheKey(k: number, m: number): string {
    return `${k}:${m}`;
}

function loadData(k: number, m: number): any[] {
    const key = getCacheKey(k, m);
    if (dataCache.has(key)) return dataCache.get(key)!;

    const filePath = path.join(BASE_DIR, `k=${k}`, `m=${m}`, 'seedConfigurations.json');
    if (!fs.existsSync(filePath)) return [];

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    dataCache.set(key, data);
    return data;
}

export async function load({ url }) {
    const available: { k: number; m: number; count: number }[] = [];

    if (fs.existsSync(BASE_DIR)) {
        for (const kFolder of fs.readdirSync(BASE_DIR)) {
            const kMatch = kFolder.match(/^k=(\d+)$/);
            if (!kMatch) continue;
            const k = parseInt(kMatch[1]);
            const kPath = path.join(BASE_DIR, kFolder);

            for (const mFolder of fs.readdirSync(kPath)) {
                const mMatch = mFolder.match(/^m=(\d+)$/);
                if (!mMatch) continue;
                const m = parseInt(mMatch[1]);
                const filePath = path.join(kPath, mFolder, 'seedConfigurations.json');
                if (fs.existsSync(filePath)) {
                    const data = loadData(k, m);
                    available.push({ k, m, count: data.length });
                }
            }
        }
    }

    available.sort((a, b) => a.k - b.k || a.m - b.m);

    const kValues = [...new Set(available.map(a => a.k))].sort((a, b) => a - b);

    const selectedK = url.searchParams.has('k')
        ? parseInt(url.searchParams.get('k')!)
        : kValues[0] ?? null;

    const mValuesForK = available.filter(a => a.k === selectedK);

    const selectedM = url.searchParams.has('m')
        ? parseInt(url.searchParams.get('m')!)
        : mValuesForK[0]?.m ?? null;

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));

    let seedConfigurations: any[] = [];
    let totalItems = 0;

    if (selectedK !== null && selectedM !== null) {
        const allData = loadData(selectedK, selectedM);
        totalItems = allData.length;
        const start = (page - 1) * PAGE_SIZE;
        seedConfigurations = allData.slice(start, start + PAGE_SIZE);
    }

    return {
        available,
        kValues,
        selectedK,
        selectedM,
        page,
        totalItems,
        seedConfigurations,
        pageSize: PAGE_SIZE,
    };
}
