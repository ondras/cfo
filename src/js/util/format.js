import * as settings from "util/settings.js";

const MASK = "rwxrwxrwx";
const autoSize = settings.get("autosize");
const UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
const UNIT_STEP = 1 << 10;

export function mode(m) {
	return MASK.replace(/./g, (ch, index) => {
		let perm = 1 << (MASK.length-index-1);
		return (m & perm ? ch : "–");
	});
}

export function date(date) {
	let d = date.getDate();
	let mo = date.getMonth()+1;
	let y = date.getFullYear();

	let h = date.getHours().toString().padStart(2, "0");
	let m = date.getMinutes().toString().padStart(2, "0");
	let s = date.getSeconds().toString().padStart(2, "0");

	return `${d}.${mo}.${y} ${h}:${m}:${s}`;
}

export function size(bytes, options = {}) {
	if (autoSize && options.auto) {
		let index = 0;
		while (bytes / UNIT_STEP >= 1 && index+1 < UNITS.length) {
			bytes /= UNIT_STEP;
			index++;
		}
		let frac = (index > 0 ? 2 : 0);
		return `${bytes.toFixed(frac)} ${UNITS[index]}`;
	} else {
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}
