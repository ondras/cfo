const mime = require("mime");

export function getType(str) {
	let mt = mime.getType(str);
	if (mt) { return mt; }

	if (str.match(/\.py$/i)) { return "text/x-python"; }

	return "file";
}