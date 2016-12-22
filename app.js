(function () {
'use strict';

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

	result.code = CODES[key] || key;

	return result;
}

function register$1(func, key) {
	let item = parse(key);
	item.func = func;
	REGISTRY.push(item);
}

window.addEventListener("keydown", handler);

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
	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
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

	activate(list) {
		if (this.supports(CHILDREN)) {
			return super.activate(list);
		} else {
			shell.openItem(this._path);
		}
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

	getImage() { return "up.png"; }
	getDescription() { return this._path.getDescription(); }
	getPath() { return this._path.getPath(); }
	activate(list) { list.setPath(this._path); }

	supports(what) {
		return (what == CHILDREN);
	}
}

function clear(node) {
	node.innerHTML = "";
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
		this._active = false;
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

	getNode() { return this._node; }
	getPath() { return this._path; }

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
		publish("list-change", this);
	}

	activate() {
		if (this._active) { return; }
		this._active = true;
		document.addEventListener("keydown", this);

		this._focusPath(this._pathToBeFocused);
		this._pathToBeFocused = null;
	}

	deactivate() {
		if (!this._active) { return; }
		this._active = false;
		document.removeEventListener("keydown", this);

		this._pathToBeFocused = this._getFocusedPath();
		this._removeFocus();
		this._input.blur();
	}

	handleEvent(e) {
		switch (e.type) {
			case "click":
				let index = this._nodeToIndex(e.target);
				if (index != -1) { this._focusAt(index); }
			break;

			case "dblclick":
				this._activatePath();
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

			case "Enter": this._activatePath(); break;

			default:
				return false;
			break;
		}

		return true;
	}

	_activatePath() {
		let path = this._getFocusedPath();
		if (!path) { return; }
		path.activate(this);
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

		if (this._active) {
			this._focusPath(this._pathToBeFocused);
			this._pathToBeFocused = null;
		}
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

	_removeFocus() {
		let index = this._getFocusedIndex();
		if (index > -1) { this._items[index].node.classList.remove("focus"); }
	}

	_focusAt(index) {
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		let oldIndex = this._getFocusedIndex();
		if (index == oldIndex) { return; }

		this._removeFocus();

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
		this._active = false;
		this._lists = [];
		this._tabs = new Tabs();
		this._labels = [];
		this._node = node("div", {className:"pane"});

		this._node.addEventListener("click", this);

		this._node.appendChild(this._tabs.getList());
		this._node.appendChild(this._tabs.getNode());

		subscribe("tab-change", this);
		subscribe("list-change", this);

		let p = new Local("/home/ondras/");
		this._addList(p);

		this._addList(p);

	}

	getNode() { return this._node; }

	activate() {
		if (this._active) { return; }
		this._active = true;
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].activate(); }
	}

	deactivate() {
		if (!this._active) { return; }
		this._active = false;
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].deactivate(); }
	}

	adjustTab(diff) {
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._tabs.selectedIndex += diff; }
	}

	getList() {
		let index = this._tabs.selectedIndex;
		return (index > -1 ? this._lists[index] : null);
	}

	handleEvent(e) {
		activate(this);
	}

	handleMessage(message, publisher, data) {
		switch (message) {
			case "tab-change":
				if (publisher != this._tabs) { return; }
				if (!this._active) { return; }
				if (data.oldIndex > -1) { this._lists[data.oldIndex].deactivate(); }
				if (data.newIndex > -1) { this._lists[data.newIndex].activate(); }
			break;

			case "list-change":
				let index = this._lists.indexOf(publisher);
				if (index > -1) { 
					let path = publisher.getPath();
					if (path) {
						let label = this._labels[index];
						clear(label);
						label.appendChild(text(path.getName()));
					}
				}
			break;
		}
	}

	_addList(path) {
		let list = new List();
		this._lists.push(list);

		let label = this._tabs.add(list.getNode());
		this._labels.push(label);

		this._tabs.selectedIndex = this._lists.length-1;

		list.setPath(path); 
	}
}

const {app} = require("electron").remote;

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

function init() {
	PANES.push(new Pane());
	PANES.push(new Pane());

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));

	activate(PANES[0]);
}

register$$1("pane:toggle", "Tab", () => {
	let i = (index + 1) % PANES.length;
	activate(PANES[i]);
});

register$$1("tab:next", "Ctrl+Tab", () => {
	getActive().adjustTab(+1);
});

register$$1("tab:prev", "Ctrl+Shift+Tab", () => {
	getActive().adjustTab(-1);
});

register$$1("list:up", "Backspace", () => {
	let list = getActive().getList();
	let parent = list.getPath().getParent();
	parent && list.setPath(parent);
});

register$$1("list:top", "Ctrl+Backspace", () => {
	let list = getActive().getList();
	let path = list.getPath();
	while (true) {
		let parent = path.getParent();
		if (parent) { 
			path = parent;
		} else {
			break;
		}
	}
	list.setPath(path);
});

register$$1("list:home", "Ctrl+H", () => {
	let home = new Local(app.getPath("home"));
	getActive().getList().setPath(home);
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

init();

}());
