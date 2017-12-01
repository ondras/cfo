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

register("window:close", "Escape", () => window.close());

document.addEventListener("click", e => {
	let action = e.target.dataset.action;
	if (!action) { return; }
	electron.ipcRenderer.send("action", action);
});

}());
