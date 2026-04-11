export async function load({ url, fetch }) {
	let folders: string[] = [];
	try {
		const res = await fetch(`${url.origin}/api/pipeline/list-folders`);
		const json = await res.json();
		folders = json.folders ?? [];
	} catch {
		// Ignore
	}
	const paramsFolderValues = folders.length > 0 ? folders : ['default'];
	const currentParamsFolder = url.searchParams.get('polygons') || paramsFolderValues[0] || 'default';
	return {
		paramsFolderValues,
		currentParamsFolder,
	};
}
