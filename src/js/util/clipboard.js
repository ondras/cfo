const clipboard = require("electron").clipboard;
const SEP = "\n";

export function set(names) {
	clipboard.writeText(names.join(SEP))
}

export function get() {
	return clipboard.readText().split(SEP);
}
