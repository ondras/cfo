(function () {
	'use strict';

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

	const settings = require("electron-settings");

	const defaults = {
		"favorites": [],
		"panes": {},
		"editor.bin": "/usr/bin/subl",
		"newfile": "new.txt",
		"terminal.bin": "/usr/bin/xfce4-terminal",
		"terminal.args": `--working-directory=%s`,
		"icons": "faenza",
		"autosize": false
	};

	function get(key) {
		return settings.get(key, defaults[key]);
	}

	function set(key, value) {
		return settings.set(key, value);
	}

	function isBool(input) {
		return (input.type == "radio" || input.type == "checkbox");
	}

	function fromForm(name) {
		let node = findName(name);
		let value = (isBool(node) ? node.checked : node.value);
		set(name, value);
	}

	function toForm(name) {
		let node = findName(name);
		let value = get(name);
		if (isBool(node)) {
			node.checked = value;
		} else {
			node.value = value;
		}
	}

	function onInput(e) {
		let node = e.target;
		fromForm(node.name);
	}

	function findName(name) {
		return document.querySelector(`[name='${name}']`);
	}

	function initName(name) {
		toForm(name);
		let node = findName(name);
		if (isBool(node)) {
			node.addEventListener("click", onInput);
		} else {
			node.addEventListener("input", onInput);
		}
	}

	function init() {
		let names = Array.from(document.querySelectorAll("[name]")).map(n => n.name);
		names.forEach(initName);
		register$1("window:close", "Escape", () => window.close());
	}

	init();

}());
