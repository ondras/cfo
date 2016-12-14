(function () {
'use strict';

class Path {
	is(other) { return other.getPath() == this.getPath(); }
	getPath() {}

	getName() {}
	getImage() {}
	getDate() {}
	getSize() {}
	getMode() {}
	getDescription() {}

	supports(what) {}
	getParent() {}
	getChildren() {}
	activate() {}
}

const CHILDREN = 0;

const MASK = "rwxrwxrwx";

function mode(m) {
	return MASK.replace(/./g, (ch, index) => {
		let perm = 1 << (MASK.length-index-1);
		return (m & perm ? ch : "–");
	});
}

function date(date) {
	let d = date.getDate();
	let mo = date.getMonth()+1;
	let y = date.getFullYear();

	let h = date.getHours().toString().padStart(2, "0");
	let m = date.getMinutes().toString().padStart(2, "0");
	let s = date.getSeconds().toString().padStart(2, "0");

	return `${d}.${mo}.${y} ${h}:${m}:${s}`;
}

function size(bytes) {
	{
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}

const fs = require("fs");
const path = require("path");
const {shell} = require("electron");

function statsToMetadata(stats) {
	return {
		isDirectory: stats.isDirectory(),
		isSymbolicLink: stats.isSymbolicLink(),
		date: stats.mtime,
		size: stats.size,
		mode: stats.mode
	}
}

function getMetadata(path, link) {
	return new Promise((resolve, reject) => {
		let cb = (err, stats) => {
			if (err) { 
				reject(err);
			} else {
				resolve(statsToMetadata(stats));
			}
		};
		link ? fs.lstat(path, cb) : fs.stat(path, cb);
	})
}

function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs.readlink(linkPath, (err, targetPath) => {
			if (err) { reject(err); } else {
				let linkDir = path.dirname(linkPath);
				let finalPath = path.resolve(linkDir, targetPath);
				resolve(finalPath);
			}
		});
	});
}

function readdir(path) {
	return new Promise((resolve, reject) => {
		fs.readdir(path, (err, files) => {
			if (err) { reject(err); } else { resolve(files); }
		});
	});
}

class Local extends Path {
	constructor(p) {
		super();
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	getPath() { return this._path; }
	getName() { return path.basename(this._path); }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { return this._meta.isDirectory ? "folder.png" : "file.png"; }

	getDescription() {
		let d = this._path;
		/* fixme relativni */
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }
		if (!this._meta_isDirectory) {
			let size$$1 = this.getSize();
			/* fixme vynuceny vypnuty autoformat */
			if (size$$1 !== undefined) { d = `${d}, ${size(size$$1)}`; }
		}
		return d;
	}
 
	getParent() {
		let parent = new this.constructor(path.dirname(this._path));
		return (parent.is(this) ? null : parent);
	}

	supports(what) { 
		switch (what) {
			case CHILDREN: return this._meta.isDirectory; break;
		}
	}

	activate() {
		shell.openItem(this._path);
	}

	getChildren() {
		return readdir(this._path).then(names => {
			let paths = names
				.map(name => path.resolve(this._path, name))
				.map(name => new this.constructor(name));

			// safe stat: always fulfills with the path
			let stat = p => { 
				let id = () => p;
				return p.stat().then(id, id);
			};

			let promises = paths.map(stat);
			return Promise.all(promises);
		});
	}

	stat() {
		return getMetadata(this._path, true).then(meta => {
			Object.assign(this._meta, meta);
			if (!meta.isSymbolicLink) { return; }

			/* symlink: get target path (readlink), get target metadata (stat), merge directory flag */

			return readlink(this._path).then(targetPath => {
				this._target = targetPath;

				/* we need to get target isDirectory flag */
				return getMetadata(this._target, false).then(meta => {
					this._meta.isDirectory = meta.isDirectory;
				}, e => { /* failed to stat link target */
					delete this._meta.isDirectory;
				});

			}, e => { /* failed to readlink */
				this._target = e;
			});
		});
	}
}

/* fixme tezko rict, jestli cestu takto maskovat, kdyz o patro vys lze jit i klavesovou zkratkou... */
class Up extends Path {
	constructor(path) {
		super();
		this._path = path;
	}

	getDescription() { return this._path.getDescription(); }
	getPath() { return this._path.getPath(); }
	getChildren() { return this._path.getChildren(); }
	getParent() { return this._path.getParent(); }
	getImage() { return "up.png"; }

	supports(what) {
		return (what == CHILDREN);
	}
}

function text(t) {
	return document.createTextNode(t);
}

function node(name, attrs = {}) {
	let n = document.createElement(name);
	return Object.assign(n, attrs);
}

function scrollIntoView(node, scrollable = node.offsetParent) {
	let nodeRect = node.getBoundingClientRect();
	let scrollableRect = scrollable.getBoundingClientRect();

	let top = nodeRect.top - scrollableRect.top;
	let bottom = scrollableRect.bottom - nodeRect.bottom;

	bottom -= (scrollable.offsetHeight - scrollable.clientHeight); // scrollable horizontal scrollbar

	if (top < 0) { scrollable.scrollTop += top; } /* upper edge above */
	if (bottom < 0) { scrollable.scrollTop -= bottom; } /* lower edge below */
}

const node$1 = document.querySelector("footer");

function set(value) {
	node$1.innerHTML = value;
}

const TEMPLATE = document.querySelector("#list");

function SORT(a, b) {
	let childScoreA = (a.supports(CHILDREN) ? 1 : 2);
	let childScoreB = (b.supports(CHILDREN) ? 1 : 2);
	if (childScoreA != childScoreB) { return childScoreA - childScoreB; }

	return a.getName().fileLocaleCompare(b.getName());
}

class List {
	constructor() {
		this._path = null;

		/* we want to focus this path when possible: 
		  1) child after listing parent,
		  2) active item during blur
		*/
		this._pathToBeFocused = null; 
		this._items = [];

		let dom = TEMPLATE.content.cloneNode(true);

		this._node = dom.querySelector(".list");
		this._scroll = dom.querySelector(".scroll");
		this._table = dom.querySelector("table");
		this._input = dom.querySelector("input");

		this._table.addEventListener("click", this);
		this._table.addEventListener("dblclick", this);
	}

	destroy() {

	}

	getNode() {
		return this._node;
	}

	setPath(path) {
		this._pathToBeFocused = this._path; // will try to focus it afterwards
		this._path = path;
		path.getChildren().then(paths => {
			if (!this._path.is(path)) { return; } /* got a new one in the meantime */
			this._show(paths);
		}, e => {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
		});
	}

	focus() {
		document.addEventListener("keydown", this);
		this._focusPath(this._pathToBeFocused);
		this._pathToBeFocused = null;
	}

	blur() {
		document.removeEventListener("keydown", this);
		this._pathToBeFocused = this._getFocusedPath();
		this._input.blur();
	}

	handleEvent(e) {
		switch (e.type) {
			case "click":
				let index = this._nodeToIndex(e.target);
				if (index != -1) { this._focusAt(index); }
			break;

			case "dblclick":
				this._activate();
			break;

			case "keydown":
				if (e.target == this._input) { 
					this._handleInputKey(e.key);
				} else {
					let handled = this._handleKey(e.key);
					if (handled) { e.preventDefault(); }
				}
			break;
		}
	}

	_handleInputKey(key) {
		switch (key) {
			case "Enter":
				this._input.blur();
				let path = new Local(this._input.value);
				this.setPath(path);
			break;

			case "Escape":
				this._input.blur();
			break;
		}
	}

	_handleKey(key) {
		switch (key) {
			case "Home": this._focusAt(0); break;
			case "End": this._focusAt(this._items.length-1); break;
			case "ArrowUp": this._focusBy(-1); break;
			case "ArrowDown": this._focusBy(+1); break;
			case "PageUp": this._focusByPage(-1); break;
			case "PageDown": this._focusByPage(+1); break;

			case "Backspace":
				let parent = this._path.getParent();
				parent && this.setPath(parent);
			break;

			case "Enter": this._activate(); break;

			default:
				return false;
			break;
		}

		return true;
	}

	_activate() {
		let path = this._getFocusedPath();
		if (path.supports(CHILDREN)) {
			this.setPath(path);
		} else {
			path.activate();
		}
	}

	_show(paths) {
		this._clear();

		this._input.value = this._path.getPath();
		paths.sort(SORT);

		let parent = this._path.getParent();
		if (parent) {
			let up = new Up(parent);
			paths.unshift(up);
		}

		this._items = this._build(paths);
		if (!paths.length) { return; }

		this._focusPath(this._pathToBeFocused);
		this._pathToBefocused = null;
	}

	_build(paths) {
		return paths.map(path => {
			let node$$1 = this._table.insertRow();

			let td = node$$1.insertCell();
			let img = node("img", {src:path.getImage()});
			td.appendChild(img);

			let name = path.getName();
			if (name) td.appendChild(text(name));

			let size$$1 = path.getSize();
			node$$1.insertCell().innerHTML = (size$$1 === undefined ? "" : size(size$$1));

			let date$$1 = path.getDate();
			node$$1.insertCell().innerHTML = (date$$1 === undefined ? "" : date(date$$1));

			let mode$$1 = path.getMode();
			node$$1.insertCell().innerHTML = (mode$$1 === undefined ? "" : mode(mode$$1));

			return {node: node$$1, path};
		});
	}

	_nodeToIndex(node$$1) {
		while (node$$1 && node$$1.nodeName.toLowerCase() != "tr") { node$$1 = node$$1.parentNode; }

		return this._items.reduce((result, item, index) => {
			return (item.node == node$$1 ? index : result);
		}, -1);
	}

	_getFocusedPath() {
		let index = this._getFocusedIndex();
		if (index == -1) { return null; }
		return this._items[index].path;
	}

	_getFocusedIndex() {
		let focused = this._table.querySelector(".focus");

		return this._items.reduce((result, item, index) => {
			return (item.node == focused ? index : result);
		}, -1);
	}

	_focusByPage(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		let sampleRow = this._items[0].node;
		let page = Math.floor(this._node.offsetHeight / sampleRow.offsetHeight);

		index += page*diff;

		return this._focusAt(index);
	}

	_focusBy(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		return this._focusAt(index + diff);
	}

	_focusAt(index) {
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		let oldIndex = this._getFocusedIndex();
		if (index == oldIndex) { return; }

		if (oldIndex > -1) { this._items[oldIndex].node.classList.remove("focus"); }
		if (index > -1) { 
			let node$$1 = this._items[index].node;
			node$$1.classList.add("focus");
			scrollIntoView(node$$1, this._scroll);

			set(this._items[index].path.getDescription());
		}
	}

	_focusPath(path) {
		let focusIndex = this._items.reduce((result, item, index) => {
			return (path && item.path.is(path) ? index : result);
		}, 0);
		this._focusAt(focusIndex);
	}

	_clear() {
		this._items = [];
		this._table.innerHTML = "";
	}
}

const storage = Object.create(null);

function publish(message, publisher, data) {
	let subscribers = storage[message] || [];
	subscribers.forEach(subscriber => {
		typeof(subscriber) == "function"
			? subscriber(message, publisher, data)
			: subscriber.handleMessage(message, publisher, data);
	});
}

function subscribe(message, subscriber) {
	if (!(message in storage)) { storage[message] = []; }
	storage[message].push(subscriber);
}

class Tabs {
	constructor() {
		this._node = node("div");
		this._list = node("ul", {className:"tabs"});
		this._selectedIndex = -1;
	}

	getNode() { return this._node; }
	getList() { return this._list; }

	handleEvent(e) {
		let all = Array.from(this._list.children);
		let index = all.indexOf(e.target);
		if (index != -1) { this.selectedIndex = index; }
	}

	add(content) {
		this._node.appendChild(content);
		content.style.display = "none";

		let li = node("li");
		li.innerHTML = "testik";
		this._list.appendChild(li);

		li.addEventListener("click", this);

		return li;
	}

	get selectedIndex() { return this._selectedIndex; }

	set selectedIndex(index) {
		if (index == this._selectedIndex) { return; }
		index = (index + this._list.children.length) % this._list.children.length; /* js negative modulus */

		let messageData = {
			oldIndex: this._selectedIndex,
			newIndex: index
		};

		if (this._selectedIndex > -1) {
			this._list.children[this._selectedIndex].classList.remove("active");
			this._node.children[this._selectedIndex].style.display = "none";
		}

		this._selectedIndex = index;

		if (this._selectedIndex > -1) {
			this._list.children[this._selectedIndex].classList.add("active");
			this._node.children[this._selectedIndex].style.display = "";
		}

		publish("tab-change", this, messageData);
	}
}

class Pane {
	constructor() {
		this._lists = [];
		this._tabs = new Tabs();
		this._node = node("div", {className:"pane"});

		this._node.appendChild(this._tabs.getList());
		this._node.appendChild(this._tabs.getNode());

		subscribe("tab-change", this);

		let p = new Local("/home/ondras/");
		this._addList(p);

		this._addList(p);

	}

	getNode() { return this._node; }

	focus() {
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].focus(); }
	}

	blur() {
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].blur(); }
	}

	adjustTab(diff) {
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._tabs.selectedIndex += diff; }
	}

	handleMessage(message, publisher, data) {
		return;
		switch (message) {
			case "tab-change":
				if (publisher != this._tabs) { return; }
				if (data.oldIndex > -1) { this._lists[data.oldIndex].blur(); }
				if (data.newIndex > -1) { this._lists[data.newIndex].focus(); }
			break;
		}
	}

	_addList(path) {
		let list = new List();
		this._lists.push(list);
		this._tabs.add(list.getNode());

		this._tabs.selectedIndex = this._lists.length-1;

		list.setPath(path); 
	}
}

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

let registry$1 = [];

function handler(e) {
	let available = registry$1.filter(reg => {
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

function register$1(func, key) {
	let item = parse(key);
	item.func = func;
	registry$1.push(item);
}

window.addEventListener("keydown", handler);
window.addEventListener("keypress", handler);

const document$1 = window.document;
const registry = Object.create(null);

function syncDisabledAttribute(command) {
	let enabled = registry[command].enabled;
	let nodes = Array.from(document$1.querySelectorAll(`[data-command='${command}']`));

	nodes.forEach(n => n.disabled = !enabled);
}

function register$$1(command, keys, func) {
	function wrap() {
		if (isEnabled(command)) {
			func(command);
			return true;
		} else {
			return false;
		}
	}

	registry[command] = {
		func: wrap,
		enabled: true
	};

	[].concat(keys || []).forEach(key => register$1(wrap, key));

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

window.FIXME = (...args) => console.error(...args);

String.prototype.fileLocaleCompare = function(other) {
	for (var i=0;i<Math.max(this.length, other.length);i++) {
		if (i >= this.length) { return -1; } /* this shorter */
		if (i >= other.length) { return  1; } /* other shorter */
		
		let ch1 = this.charAt(i);
		let ch2 = other.charAt(i);
		let c1 = ch1.charCodeAt(0);
		let c2 = ch2.charCodeAt(0);
		
		let special1 = (c1 < 128 && !ch1.match(/a-z/i)); /* non-letter char in this */
		let special2 = (c2 < 128 && !ch2.match(/a-z/i)); /* non-letter char in other */
		
		if (special1 != special2) { return (special1 ? -1 : 1); } /* one has special, second does not */
		
		let r = ch1.localeCompare(ch2); /* locale compare these two normal letters */
		if (r) { return r; }
	}

	return 0; /* same length, same normal/special positions, same localeCompared normal chars */
};

if (!("".padStart)) { 
	String.prototype.padStart = function(len, what = " ") {
		let result = this;
		while (result.length < len) { result = `${what}${result}`; }
		return result;
	};
}

let PANES = [];
let index = -1;

function focus(i) {
	if (index > -1) { PANES[index].blur(); }
	index = i;
	if (index > -1) { PANES[index].focus(); }
}

function build() {
	PANES.push(new Pane());
	PANES.push(new Pane());

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));
	focus(0);
}

build();

register$$1("pane:toggle", "Tab", () => {
	focus((index + 1) % PANES.length);
});

register$$1("tab:next", "Ctrl+Tab", () => {
	PANES[index].adjustTab(+1);
});

register$$1("tab:prev", "Ctrl+Shift+Tab", () => {
	PANES[index].adjustTab(-1);
});

}());
