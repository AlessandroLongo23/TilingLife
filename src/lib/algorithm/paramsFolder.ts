/**
 * Builds a readable folder name from polygon generator parameters.
 * Used to differentiate seed configurations, seed sets, and tilings by polygon set.
 *
 * Examples:
 * - reg_12: only regular polygons up to n=12
 * - reg_12_star_reg_12_30: regular + star regular (n≤12, angle 30°)
 * - star_param_12: star parametric up to n=12
 * - equi_5_30: equilateral n≤5, angle 30°
 * - dual_12: dual polygons from regular n≤12
 */
import { PolygonType } from '$classes';
import type { GeneratorParameters } from '$classes';
import { toDegrees } from '$utils';

export function buildParamsFolderName(parameters: GeneratorParameters): string {
	const parts: string[] = [];

	if (parameters[PolygonType.REGULAR]) {
		parts.push(`reg_${parameters[PolygonType.REGULAR].n_max}`);
	}
	if (parameters[PolygonType.STAR_REGULAR]) {
		const p = parameters[PolygonType.STAR_REGULAR];
		const angleStr = p.angle !== undefined ? `_${Math.round(toDegrees(p.angle))}` : '';
		parts.push(`star_reg_${p.n_max}${angleStr}`);
	}
	if (parameters[PolygonType.STAR_PARAMETRIC]) {
		parts.push(`star_param_${parameters[PolygonType.STAR_PARAMETRIC].n_max}`);
	}
	if (parameters[PolygonType.EQUILATERAL]) {
		const p = parameters[PolygonType.EQUILATERAL];
		parts.push(`equi_${p.n_max}_${Math.round(toDegrees(p.angle))}`);
	}
	if (parameters[PolygonType.DUAL]) {
		parts.push(`dual_${parameters[PolygonType.DUAL].n_max}`);
	}

	return parts.length > 0 ? parts.join('_') : 'default';
}
