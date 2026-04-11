/**
 * Chiral-aware utilities for vertex configurations.
 * Chiral pairs (e.g. 3.3.12.4 and 3.4.12.3) are treated as the same VC type.
 */

/** True if two VC names are chiral-equivalent (same up to rotation/reversal). */
export function vcNamesChiralMatch(a: string, b: string): boolean {
	const arrA = a.split(',');
	const arrB = b.split(',');
	if (arrA.length !== arrB.length) return false;
	const n = arrA.length;
	for (let i = 0; i < n; i++) {
		const rotated = arrA.slice(i).concat(arrA.slice(0, i));
		if (rotated.every((v, j) => v === arrB[j])) return true;
	}
	const reversed = arrA.slice().reverse();
	for (let i = 0; i < n; i++) {
		const rotated = reversed.slice(i).concat(reversed.slice(0, i));
		if (rotated.every((v, j) => v === arrB[j])) return true;
	}
	return false;
}

/** Number of unique VCs when chiral pairs count as one. */
export function getEffectiveUniqueCount(vcNames: string[]): number {
	const groups: string[][] = [];
	for (const name of vcNames) {
		let found = false;
		for (const group of groups) {
			if (vcNamesChiralMatch(group[0], name)) {
				group.push(name);
				found = true;
				break;
			}
		}
		if (!found) groups.push([name]);
	}
	return groups.length;
}

/** Grouping label when chiral pairs count as one: e.g. "2:1:1". */
export function getEffectiveGrouping(vcNames: string[]): string {
	const counts = new Map<string, number>();
	for (const name of vcNames.filter(Boolean)) {
		let key: string | null = null;
		for (const k of counts.keys()) {
			if (vcNamesChiralMatch(k, name)) {
				key = k;
				break;
			}
		}
		if (key === null) key = name;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const values = [...counts.values()].sort((a, b) => b - a);
	return values.length ? values.join(':') : '';
}
