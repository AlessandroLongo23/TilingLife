/**
 * Compact notation for seed configuration names.
 * - Within a VC: group consecutive same numbers with exponents (3,3,3,4,4 → 3³.4²)
 * - Within the seed: group consecutive same VCs with exponents (A;A;B;B → A²;B²)
 * Uses dots (.) as separator within VCs; exponents only when count > 1.
 */

/**
 * Compacts a single VC name: "3,3,3,4,4" → "3³.4²"
 * Groups consecutive same numbers; uses exponent only when count > 1.
 */
export function compactVcName(vcName: string): string {
	const parts = vcName.split(',');
	if (parts.length === 0) return '';

	const groups: { value: string; count: number }[] = [];
	for (const p of parts) {
		const v = p.trim();
		if (!v) continue;
		if (groups.length > 0 && groups[groups.length - 1].value === v) {
			groups[groups.length - 1].count++;
		} else {
			groups.push({ value: v, count: 1 });
		}
	}

	return groups
		.map(({ value, count }) => (count > 1 ? `${value}^${count}` : value))
		.join('.');
}

/**
 * Compacts a full seed name: "[3,3,3,4,4;3,3,3,4,4;3,3,3,3,6;3,3,3,3,6]" → "[(3³.4²)²;(3⁴.6)²]"
 * Groups VCs with the same name regardless of order; groups sorted lexicographically.
 * Returns string with ^ for exponents (to be rendered as superscript).
 */
export function compactSeedName(seedName: string): string {
	const inner = seedName.slice(1, -1);
	if (!inner) return seedName;

	const vcNames = inner.split(';');
	const compactVcs = vcNames.map((vc) => compactVcName(vc));

	// Group all VCs with the same name (order doesn't matter)
	const byVc = new Map<string, number>();
	for (const vc of compactVcs) {
		byVc.set(vc, (byVc.get(vc) ?? 0) + 1);
	}

	// Sort groups lexicographically by VC name
	const sorted = [...byVc.entries()].sort((a, b) => a[0].localeCompare(b[0]));

	const parts = sorted.map(([vc, count]) => {
		const wrapped = vc.includes('.') || vc.includes('^') ? `(${vc})` : vc;
		return count > 1 ? `${wrapped}^${count}` : wrapped;
	});

	return `[${parts.join(';')}]`;
}

/**
 * Converts compact string with ^ exponents to HTML with <sup> tags.
 * E.g. "3^3.4^2" → "3<sup>3</sup>.4<sup>2</sup>"
 */
export function compactToHtml(compact: string): string {
	// Replace number^number (inner exponents)
	let html = compact.replace(/(\d+)\^(\d+)/g, '$1<sup>$2</sup>');
	// Replace )^number (VC grouping exponents)
	html = html.replace(/\)\^(\d+)/g, ')<sup>$1</sup>');
	return html;
}

/**
 * Normalizes a seed name for search comparison.
 * "[3,3,3,4,4;3,3,3,3,6]" → "33344;33336"
 * Each VC becomes concatenated digits; VCs separated by ;
 */
export function normalizeSeedForSearch(seedName: string): string {
	const inner = seedName.slice(1, -1);
	if (!inner) return '';
	const vcNames = inner.split(';');
	return vcNames
		.map((vc) => vc.split(/[,.\s]+/).filter(Boolean).join(''))
		.filter(Boolean)
		.join(';');
}

/**
 * Expands a compact VC expression to digit sequence: "3^3.4^2" → "33344"
 */
function expandCompactVc(expr: string): string {
	const parts = expr.split('.');
	let result = '';
	for (const p of parts) {
		const m = p.match(/^(\d+)\^(\d+)$/);
		if (m) {
			result += m[1].repeat(parseInt(m[2], 10));
		} else if (/^\d+$/.test(p)) {
			result += p;
		}
	}
	return result;
}

/**
 * Parses and expands a search part that may have (X)^n: "(3^3.4^2)^2" → ["33344", "33344"]
 */
function expandSearchPart(part: string): string[] {
	part = part.trim();
	if (!part) return [];

	const outerMatch = part.match(/^\((.+)\)\^(\d+)$/);
	if (outerMatch) {
		const inner = outerMatch[1];
		const n = parseInt(outerMatch[2], 10);
		const vc = expandCompactVc(inner);
		return Array(n).fill(vc);
	}

	// Simple VC: "33344" or "3^3.4^2"
	const vc = expandCompactVc(part);
	return vc ? [vc] : [];
}

/**
 * Normalizes a search query for matching.
 * - Removes all whitespace
 * - Accepts extended: [3,3,3,4,4;3,3,3,3,6] or 3 3 3 4 4 ; 3 3 3 3 6
 * - Accepts compact: [(3^3.4^2)^2;(3^4.6)^2]
 * - Expands (X)^n for VCs with multiplicity > 1
 * Returns canonical form "vc1;vc2;vc3" or null if empty/invalid
 */
export function normalizeSearchQuery(query: string): string | null {
	const s = query.replace(/\s/g, '');
	if (!s) return null;

	// Strip optional outer brackets
	const inner = s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s;
	if (!inner) return null;

	const parts = inner.split(';');
	const vcs: string[] = [];

	for (const part of parts) {
		// Check for (X)^n pattern
		const expanded = expandSearchPart(part);
		if (expanded.length > 0) {
			vcs.push(...expanded);
		} else {
			// Extended notation: digits and commas/dots
			const digits = part.split(/[,.\s]+/).filter(Boolean).join('');
			if (digits) vcs.push(digits);
		}
	}

	return vcs.length > 0 ? vcs.join(';') : null;
}

/**
 * Returns true if the seed matches the search query.
 * Match: normalized seed contains the normalized search (as substring).
 */
export function seedMatchesSearch(seedName: string, searchQuery: string): boolean {
	const normSearch = normalizeSearchQuery(searchQuery);
	if (!normSearch) return true; // empty search = match all

	const normSeed = normalizeSeedForSearch(seedName);
	return normSeed.includes(normSearch);
}
