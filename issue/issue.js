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

	/* Issue window - local (ui) part */

	const electron = require("electron");

	electron.ipcRenderer.on("config", (e, data) => {
		let text$$1 = document.querySelector("#text");
		clear(text$$1);
		text$$1.appendChild(text(data.text));

		Array.from(document.querySelectorAll("button")).forEach(b => {
			if (data.buttons.includes(b.dataset.action)) { return; }
			b.parentNode.removeChild(b);
		});

		document.querySelector("button").focus();
	});

	register$1("window:close", "Escape", () => window.close());

	document.addEventListener("click", e => {
		let action = e.target.dataset.action;
		if (!action) { return; }
		electron.ipcRenderer.send("action", action);
	});

}());
