const codes = {
	back: 8,
	tab: 9,
	enter: 13,
	esc: 27,
	space: 32,
	pgup: 33,
	pgdn: 34,
	end: 35,
	home: 36,
	left: 37,
	up: 38,
	right: 39,
	down: 40,
	ins: 45,
	del: 46,
	f1: 112,
	f2: 113,
	f3: 114,
	f4: 115,
	f5: 116,
	f6: 117,
	f7: 118,
	f8: 119,
	f9: 120,
	f10: 121,
	f11: 122,
	f12: 123
};

const modifiers = ["ctrl", "alt", "shift", "meta"]; // meta = command

let registry = [];

function handler(e) {
	let available = registry.filter(reg => {
		if (reg.type != e.type) { return false; }

		for (let m in reg.modifiers) {
			if (reg.modifiers[m] != e[m]) { return false; }
		}

		let code = (e.type == "keypress" ? e.charCode : e.keyCode);
		if (reg.code != code) { return false; }

		return true;
	});


	let index = available.length;
	if (!index) { return; }

	while (index --> 0) {
		let executed = available[index].func();
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

	modifiers.forEach(mod => {
		let mkey = mod + "Key";
		result.modifiers[mkey] = false;

		let re = new RegExp(mod + "[+-]");
		key = key.replace(re, () => {
			result.modifiers[mkey] = true;
			return "";
		});
	});

	if (key.length == 1) {
		result.code = key.charCodeAt(0);
		result.type = "keypress";
	} else {
		if (!(key in codes)) { throw new Error("Unknown keyboard code " + key); }
		result.code = codes[key];
		result.type = "keydown";
	}

	return result;
}

export function register(func, key) {
	let item = parse(key);
	item.func = func;
	registry.push(item);
}

window.addEventListener("keydown", handler);
window.addEventListener("keypress", handler);
