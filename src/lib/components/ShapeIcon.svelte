<script>
	let { sides = 3, size = 32, color } = $props();

	function getHue(sides) {
		return Math.round(((sides - 3) / 9) * 300);
	}
	const fill = color
		? color
		: `hsla(${getHue(sides)}, 100%, 80%, 0.8)`;

	function getPolygonPoints(sides, radius, cx, cy) {
		const angleStep = (2 * Math.PI) / sides;
		const points = [];
		const rotation = sides === 3 ? -Math.PI / 2 : (2 * Math.PI) / sides / 2;
		for (let i = 0; i < sides; i++) {
			const angle = i * angleStep + rotation;
			const x = cx + radius * Math.cos(angle);
			const y = cy + radius * Math.sin(angle);
			points.push(`${x},${y}`);
		}
		return points.join(' ');
	}
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	class="shape-svg"
	aria-label="polygon"
>
	<polygon
		points={getPolygonPoints(sides, size / 2 - 2, 16, 16)}
		fill={fill}
	/>
	<text
		x="16"
		y="20"
		text-anchor="middle"
		font-size="14"
		fill="white"
		font-weight="bold"
		alignment-baseline="middle"
		style="text-shadow: 0 2px 5px rgba(0,0,0,1);"
	>
		{sides}
	</text>
</svg>

<style>
	.shape-svg {
		display: block;
	}
</style>