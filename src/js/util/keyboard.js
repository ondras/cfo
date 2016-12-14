/* Accelerator-to-KeyboardEvent.code mapping where not 1:1 */
const CODES = {
	"return": "enter",
	"left": "arrowleft",
	"up": "arrowup",
	"right": "arrowright",
	"down": "arrowdown",
	"esc": "escape"
};

const MODIFIERS = ["ctrl", "alt", "shift", "meta"]; // meta = command
const REGISTRY = [];

function handler(e) {
	let available = REGISTRY.filter(reg => {
		if (reg.type != e.type) { return false; }

		for (let m in reg.modifiers) {
			if (reg.modifiers[m] != e[m]) { return false; }
		}

		if ("key" in reg && reg.key != e.key.toLowerCase()) { return false; }
		if ("code" in reg && reg.code != e.code.toLowerCase()) { return false; }

		return true;
	});

	while (available.length) {
		let executed = available.pop().func();
		if (executed) { 
			e.preventDefault();
			return;
		}
	}
}

function parse(key) {
	let result = {
		func: null,
		modifiers: {}
	};

	key = key.toLowerCase();

	MODIFIERS.forEach(mod => {
		let mkey = mod + "Key";
		result.modifiers[mkey] = false;

		let re = new RegExp(mod + "[+-]");
		key = key.replace(re, () => {
			result.modifiers[mkey] = true;
			return "";
		});
	});

	if (key.length == 1) {
		result.key = key.charCodeAt(0);
		result.type = "keypress";
	} else {
		result.code = CODES[key] || key;
		result.type = "keydown";
	}

	return result;
}

export function register(func, key) {
	let item = parse(key);
	item.func = func;
	REGISTRY.push(item);
}

window.addEventListener("keydown", handler);
window.addEventListener("keypress", handler);
