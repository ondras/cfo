const MASK = "rwxrwxrwx";

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

export function size(bytes) {
	if (0 /*this.getPreference("autosize") */) {
		var units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
		var step = 1 << 10;
		var index = 0;
		while (bytes / step >= 1 && index+1 < units.length) {
			bytes /= step;
			index++;
		}
		return `${bytes.toFixed(2)}  ${units[index]}`;
	} else {
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}
