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
const INPUTS = new Set(["input", "textarea", "button"]);

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

function register$1(func, key) {
	let item = parse(key);
	item.func = func;
	REGISTRY.push(item);
}

window.addEventListener("keydown", handler);

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

// list children
 // create descendants
 // can we read contents?
 // can we rename / modify contents?

const promisify = require("util").promisify;
const fs$1 = require("fs");

const readlink = promisify(fs$1.readlink);
const readdir = promisify(fs$1.readdir);
const mkdir = promisify(fs$1.mkdir);
const rmdir = promisify(fs$1.rmdir);
const open = promisify(fs$1.open);
const close = promisify(fs$1.close);
const rename = promisify(fs$1.rename);
const unlink = promisify(fs$1.unlink);
const utimes = promisify(fs$1.utimes);
const symlink = promisify(fs$1.symlink);

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

const autoSize = get("autosize");

const type = {
	"mime": "mimetypes",
	"place": "places",
	"action": "actions",
	"emblem": "emblems"
};

const fallback = {
	"audio/wav": "audio/x-wav",
	"audio/ogg": "audio/x-vorbis+ogg",
	"application/x-httpd-php": "application/x-php",
	"application/x-tex": "text/x-tex",
	"application/x-sh": "application/x-shellscript",
	"application/java-archive": "application/x-java-archive",
	"application/x-sql": "text/x-sql",
	"audio/x-flac": "audio/x-flac+ogg",
	"image/x-pixmap": "gnome-mime-image/x-xpixmap",
	"font/otf": "font/x-generic",
	"application/font-woff": "font/x-generic",
	"application/font-woff2": "font/x-generic",
	"application/x-font-ttf": "font/x-generic",
	"audio/mp4": "audio/x-generic"
};

function formatPath(path) {
	let name = path.name;
	if (name in fallback) { name = fallback[name]; }
	name = name.replace(/\//g, "-");
	return `../img/faenza/${type[path.type]}/16/${name}.png`;
}


var faenza = Object.freeze({
	formatPath: formatPath
});

const type$1 = {
	"mime": "mimetypes",
	"place": "places",
	"action": "actions",
	"emblem": "emblems"
};

const fallback$1 = {
	"audio/wav": "audio/x-wav",
	"audio/ogg": "audio/x-vorbis+ogg",
	"application/x-httpd-php": "application/x-php",
	"application/x-tex": "text/x-tex",
	"application/x-sh": "application/x-shellscript",
	"application/java-archive": "application/x-java-archive",
	"text/less": "text/x-scss",
	"text/coffeescript": "application/vnd.coffeescript",
	"application/x-sql": "application/sql",
	"application/font-woff": "font/woff",
	"application/font-woff2": "font/woff",
	"application/rdf+xml": "text/rdf+xml"
};

function formatPath$1(path) {
	let name = path.name;
	if (name in fallback$1) { name = fallback$1[name]; }
	name = name.replace(/\//g, "-");
	return `../img/numix/${type$1[path.type]}/${name}.svg`;
}



var numix = Object.freeze({
	formatPath: formatPath$1
});

const THEMES = {faenza, numix};
const THEME = THEMES[get("icons")];

const mime = require("mime");

const fs = require("fs");
const path = require("path");
const {shell} = require("electron").remote;

const background = "#e8e8e8";

/* Progress window - remote (data) part */

const remote = require("electron").remote;
const windowOptions = {
	parent: remote.getCurrentWindow(),
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

const remote$1 = require("electron").remote;
const windowOptions$1 = {
	parent: remote$1.getCurrentWindow(),
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

const {app} = require("electron").remote;

function fromForm(name) {
	let node$$1 = findName(name);
	let value = ("checked" in node$$1 ? node$$1.checked : node$$1.value);
	set(name, value);
}

function toForm(name) {
	let node$$1 = findName(name);
	let value = get(name);
	if ("checked" in node$$1) {
		node$$1.checked = value;
	} else {
		node$$1.value = value;
	}
}

function onInput(e) {
	let node$$1 = e.target;
	fromForm(node$$1.name);
}

function findName(name) {
	return document.querySelector(`[name='${name}']`);
}

function initName(name) {
	toForm(name);
	let node$$1 = findName(name);
	if ("checked" in node$$1) {
		node$$1.addEventListener("click", onInput);
	} else {
		node$$1.addEventListener("input", onInput);
	}
}

function init() {
	let names = Array.from(document.querySelectorAll("[name]")).map(n => n.name);
	names.forEach(initName);
	register("window:close", "Escape", () => window.close());
}

init();

}());
