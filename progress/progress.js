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
	const INPUTS = new Set(["input", "textarea"]);

	function handler(e) {
		let nodeName = e.target.nodeName.toLowerCase();
		// jen kdyz nejsme ve formularovem prvku... s pochybnou vyjimkou readOnly <textarea>, coz je text viewer
		if (INPUTS.has(nodeName) && !e.target.readOnly) { return; }

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

	function register(func, key) {
		let item = parse(key);
		item.func = func;
		REGISTRY.push(item);
	}

	window.addEventListener("keydown", handler);

	const registry = Object.create(null);

	function register$1(command, keys, func) {
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

		keys.forEach(key => register(wrap, key));

		return command;
	}

	function isEnabled(command) {
		return registry[command].enabled;
	}

	/* Progress window - local (ui) part */

	const electron = require("electron");

	const DOM = {
		row1: {
			label: document.querySelector("dt.row-1"),
			value: document.querySelector("dd.row-1")
		},
		row2: {
			label: document.querySelector("dt.row-2"),
			value: document.querySelector("dd.row-2")
		},
		progress1: {
			label: document.querySelector("dt.progress-1"),
			value: document.querySelector("dd.progress-1 progress")
		},
		progress2: {
			label: document.querySelector("dt.progress-2"),
			value: document.querySelector("dd.progress-2 progress")
		}
	};

	electron.ipcRenderer.on("config", (e, data) => {
		if ("row1" in data) {
			DOM.row1.label.appendChild(text(data.row1));
		} else {
			DOM.row1.label.style.display = "none";
			DOM.row1.value.style.display = "none";
		}

		if ("row2" in data) {
			DOM.row2.label.appendChild(text(data.row2));
		} else {
			DOM.row2.label.style.display = "none";
			DOM.row2.value.style.display = "none";
		}

		if ("progress1" in data) {
			DOM.progress1.label.appendChild(text(data.progress1));
		} else {
			DOM.progress1.label.style.display = "none";
			DOM.progress1.value.style.display = "none";
		}

		if ("progress2" in data) {
			DOM.progress2.label.appendChild(text(data.progress2));
		} else {
			DOM.progress2.label.style.display = "none";
			DOM.progress2.value.style.display = "none";
		}
	});

	electron.ipcRenderer.on("data", (e, data) => {
		let node$$1;

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

	register$1("window:close", "Escape", () => {
		window.close();
	});

}());
