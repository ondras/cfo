(function () {
'use strict';

function text(t) {
	return document.createTextNode(t);
}

function node(name, attrs = {}, content = "") {
	let n = document.createElement(name);
	content && n.appendChild(text(content));
	return Object.assign(n, attrs);
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

// list children
 // create descendants
 // edit file via the default text editor
 // quickedit or attempt to move (on a same filesystem)
 // self-explanatory
 // copy from FIXME pouzivat pro detekci
 // view using an internal viewer

const fs$1 = require("fs");

const fs = require("fs");
const path = require("path");
const {shell} = require("electron").remote;

const background = "#e8e8e8";

/* Progress window - remote (data) part */

const remote$1 = require("electron").remote;
const windowOptions = {
	parent: remote$1.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	center: true,
	width: 500,
	height: 100,
	show: false,
	useContentSize: true,
	backgroundColor: background
};

/* Issue window - remote (data) part */

const remote$2 = require("electron").remote;
const windowOptions$1 = {
	parent: remote$2.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	alwaysOnTop: true,
	center: true,
	width: 500,
	height: 60,
	show: false,
	useContentSize: true,
	backgroundColor: background
};

let resolve;

const body = document.body;
const form = node("form", {id:"prompt", className:"dialog"});
const text$1 = node("p");
const input = node("input", {type:"text"});
const ok = node("button", {type:"submit"}, "OK");
const cancel = node("button", {type:"button"}, "Cancel");

form.appendChild(text$1);
form.appendChild(input);
form.appendChild(ok);
form.appendChild(cancel);

form.addEventListener("submit", e => {
	e.preventDefault();
	close$1(input.value);
});

cancel.addEventListener("click", e => {
	close$1(false);
});

function onKeyDown(e) {
	if (e.key == "Escape") { close$1(null); }
	e.stopPropagation();
}

function close$1(value) {
	window.removeEventListener("keydown", onKeyDown, true);
	body.classList.remove("modal");
	form.parentNode.removeChild(form);
	resolve(value);
}

const node$1 = document.querySelector("footer");

const TEMPLATE = document.querySelector("#list");

const PANES = [];
let index = -1;

function activate(pane) {
	index = PANES.indexOf(pane);
	PANES[(index+1) % 2].deactivate();
	PANES[index].activate();
}

function getActive() {
	return PANES[index];
}







register("pane:toggle", "Tab", () => {
	let i = (index + 1) % PANES.length;
	activate(PANES[i]);
});

register("tab:next", "Ctrl+Tab", () => {
	getActive().adjustTab(+1);
});

register("tab:prev", "Ctrl+Shift+Tab", () => {
	getActive().adjustTab(-1);
});

register("tab:new", "Ctrl+T", () => {
	getActive().addList();
});

register("tab:close", "Ctrl+W", () => {
	getActive().removeList();
});

let resolve$1;

const body$1 = document.body;
const form$1 = node("form", {id:"confirm", className:"dialog"});
const text$2 = node("p");
const ok$1 = node("button", {type:"submit"}, "OK");
const cancel$1 = node("button", {type:"button"}, "Cancel");

form$1.appendChild(text$2);
form$1.appendChild(ok$1);
form$1.appendChild(cancel$1);

form$1.addEventListener("submit", e => {
	e.preventDefault();
	close$2(true);
});

cancel$1.addEventListener("click", e => {
	close$2(false);
});

function onKeyDown$1(e) {
	if (e.key == "Escape") { close$2(false); }
	e.stopPropagation();
}

function close$2(value) {
	window.removeEventListener("keydown", onKeyDown$1, true);
	body$1.classList.remove("modal");
	form$1.parentNode.removeChild(form$1);
	resolve$1(value);
}

const {remote} = require('electron');
const settings = remote.require('electron-settings');

const {app} = require("electron").remote;

/* Audio/Video viewer window - local (ui) part */

const electron = require("electron");

electron.ipcRenderer.on("path", (e, data, nodeName) => {
	let node$$1 = document.createElement(nodeName);
	node$$1.src = data;
	node$$1.controls = true;
	node$$1.autoplay = true;
	document.body.appendChild(node$$1);
});

register("window:close", "Escape", () => {
	window.close();
});

}());
