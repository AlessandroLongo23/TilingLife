import fs from 'fs';
import path from 'path';
import { SeedConfiguration } from '$classes';

const BASE_DIR = 'src/lib/classes/algorithm/seedConfigurations';
const PAGE_SIZE = 24;
const BATCH_SIZE = 200;

function loadManifest(k: number, m: number): { total: number; format: string; batchSize: number } | null {
    const manifestPath = path.join(BASE_DIR, `k=${k}`, `m=${m}`, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest;
}

function loadBatch(k: number, m: number, batchIndex: number): any[] {
    const batchPath = path.join(BASE_DIR, `k=${k}`, `m=${m}`, `seedConfigurations_${String(batchIndex).padStart(4, '0')}.json`);
    if (!fs.existsSync(batchPath)) return [];
    return JSON.parse(fs.readFileSync(batchPath, 'utf8'));
}

function loadPageData(k: number, m: number, page: number): { data: any[]; total: number } {
    const folderPath = path.join(BASE_DIR, `k=${k}`, `m=${m}`);

    const manifest = loadManifest(k, m);
    if (manifest) {
        const { total, format } = manifest;
        const start = (page - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, total);
        if (start >= total) return { data: [], total };

        const batchStart = Math.floor(start / BATCH_SIZE);
        const batchEnd = Math.floor((end - 1) / BATCH_SIZE);
        const allData: any[] = [];
        for (let i = batchStart; i <= batchEnd; i++) {
            allData.push(...loadBatch(k, m, i));
        }
        const pageData = allData.slice(start - batchStart * BATCH_SIZE, end - batchStart * BATCH_SIZE);

        if (format === 'compact') {
            const decoded = pageData.map((item: any) => SeedConfiguration.decodeCompact(item));
            return { data: decoded, total };
        }
        return { data: pageData, total };
    }

    const legacyPath = path.join(folderPath, 'seedConfigurations.json');
    if (!fs.existsSync(legacyPath)) return { data: [], total: 0 };
    const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    const total = data.length;
    const start = (page - 1) * PAGE_SIZE;
    return { data: data.slice(start, start + PAGE_SIZE), total };
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
                const manifest = loadManifest(k, m);
                if (manifest) {
                    available.push({ k, m, count: manifest.total });
                } else {
                    const legacyPath = path.join(kPath, mFolder, 'seedConfigurations.json');
                    if (fs.existsSync(legacyPath)) {
                        const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
                        available.push({ k, m, count: data.length });
                    }
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
        const result = loadPageData(selectedK, selectedM, page);
        seedConfigurations = result.data;
        totalItems = result.total;
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
