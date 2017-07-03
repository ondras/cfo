(function () {
'use strict';

function clear(node) {
	node.innerHTML = "";
}

function text(t) {
	return document.createTextNode(t);
}

/* Accelerator-to-KeyboardEvent.key mapping where not 1:1 */
const KEYS = {
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
	console.log(e);
	let available = REGISTRY.filter(reg => {
		for (let m in reg.modifiers) {
			if (reg.modifiers[m] != e[m]) { return false; }
		}

		if (reg.key != e.key.toLowerCase() && reg.key != e.code.toLowerCase()) { return false; }

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

	result.key = KEYS[key] || key;

	return result;
}

function register$1(func, key) {
	let item = parse(key);
	item.func = func;
	REGISTRY.push(item);
}

window.addEventListener("keydown", handler);

const document$1 = window.document;
const registry = Object.create(null);

function register(command, keys, func) {
	function wrap() {
		if (isEnabled(command)) {
			func(command);
			return true;
		} else {
			return false;
		}
	}

	keys = [].concat(keys || []);

	registry[command] = {
		func: wrap,
		enabled: true,
		key: keys[0]
	};

	keys.forEach(key => register$1(wrap, key));

	return command;
}





function isEnabled(command) {
	return registry[command].enabled;
}

function execute(command) {
	return registry[command].func();
}



document$1.body.addEventListener("click", e => {
	let node = e.target;
	while (node) {
		let c = node.getAttribute("data-command");
		if (c) { return execute(c); }
		if (node == event.currentTarget) { break; }
		node = node.parentNode;
	}
});

/* Progress window - local (ui) part */

const electron = require("electron");

const row1 = document.querySelector("#row-1");
const row2 = document.querySelector("#row-2");
const progress1 = document.querySelector("#progress-1");
const progress2 = document.querySelector("#progress-2");

const DOM = {
	row1: {
		node: row1,
		label: row1.querySelector("dt"),
		value: row1.querySelector("dd")
	},
	row2: {
		node: row2,
		label: row2.querySelector("dt"),
		value: row2.querySelector("dd")
	},
	progress1: {
		node: progress1,
		label: progress1.querySelector("dt"),
		value: progress1.querySelector("progress")
	},
	progress2: {
		node: progress2,
		label: progress2.querySelector("dt"),
		value: progress2.querySelector("progress")
	}
};

electron.ipcRenderer.on("config", (e, data) => {
	if ("row1" in data) {
		DOM.row1.label.appendChild(text(data.row1));
	} else {
		DOM.row1.node.style.display = "none";
	}

	if ("row2" in data) {
		DOM.row2.label.appendChild(text(data.row2));
	} else {
		DOM.row2.node.style.display = "none";
	}

	if ("progress1" in data) {
		DOM.progress1.label.appendChild(text(data.progress1));
	} else {
		DOM.progress1.node.style.display = "none";
	}

	if ("progress2" in data) {
		DOM.progress2.label.appendChild(text(data.progress2));
	} else {
		DOM.progress2.node.style.display = "none";
	}
});

electron.ipcRenderer.on("data", (e, data) => {
	let node$$1;
	console.log(data);

	if ("row1" in data) {
		node$$1 = DOM.row1.value;
		clear(node$$1);
		node$$1.appendChild(text(data.row1));
	}

	if ("row2" in data) {
		node$$1 = DOM.row2.value;
		clear(node$$1);
		node$$1.appendChild(text(data.row2));
	}

	if ("progress1" in data) {
		node$$1 = DOM.progress1.value;
		node$$1.value = data.progress1;
	}

	if ("progress2" in data) {
		node$$1 = DOM.progress2.value;
		node$$1.value = data.progress2;
	}
});

register("window:close", "Escape", () => {
	window.close();
});

}());
