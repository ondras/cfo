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

class Path {
	static match(str) { return false; }
	is(other) { return other.toString() == this.toString(); }

	/* sync getters */
	toString() {}
	getName() {}
	getImage() {}
	getDate() {}
	getSize() {}
	getMode() {}
	getDescription() { return this.toString(); }
	getParent() {}
	append(leaf) {}

	/* never fails */
	async stat() {}

	/* these can be called only after stat */
	exists() {}
	supports(what) {}
	async getChildren() {}

	/* misc */
	async create(opts) {}
	async rename(newPath) {}
	async delete() {}
	async setDate(date) {}
	createStream(type, opts) {}

	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
}

const CHILDREN = 0; // list children
const CREATE = 1; // create descendants
const EDIT = 2; // edit file via the default text editor
const RENAME = 3; // quickedit or attempt to move (on a same filesystem)
const DELETE = 4; // self-explanatory
 // copy from FIXME pouzivat pro detekci
const VIEW = 6; // view using an internal viewer

const fs$1 = require("fs");
const path$1 = require("path");

function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs$1.readlink(linkPath, (err, targetPath) => {
			if (err) { reject(err); } else {
				let linkDir = path$1.dirname(linkPath);
				let finalPath = path$1.resolve(linkDir, targetPath);
				resolve(finalPath);
			}
		});
	});
}

function readdir(path) {
	return new Promise((resolve, reject) => {
		fs$1.readdir(path, (err, files) => {
			err ? reject(err) : resolve(files);
		});
	});
}

function mkdir(path, mode) {
	return new Promise((resolve, reject) => {
		fs$1.mkdir(path, mode, err => {
			err ? reject(err) : resolve();
		});
	});
}

function open(path, flags, mode) {
	return new Promise((resolve, reject) => {
		fs$1.open(path, flags, mode, (err, fd) => {
			err ? reject(err) : resolve(fd);
		});
	});
}

function close(fd) {
	return new Promise((resolve, reject) => {
		fs$1.close(fd, err => {
			err ? reject(err) : resolve();
		});
	})
}

function rename(oldPath, newPath) {
	return new Promise((resolve, reject) => {
		fs$1.rename(oldPath, newPath, err => {
			err ? reject(err) : resolve();
		});
	})
}

function unlink(path) {
	return new Promise((resolve, reject) => {
		fs$1.unlink(path, err => {
			err ? reject(err) : resolve();
		});
	});
}

function rmdir(path) {
	return new Promise((resolve, reject) => {
		fs$1.rmdir(path, err => {
			err ? reject(err) : resolve();
		});
	});
}

function utimes(path, atime, mtime) {
	return new Promise((resolve, reject) => {
		fs$1.utimes(path, atime, mtime, err => {
			err ? reject(err) : resolve();
		});
	});
}

function symlink(target, path) {
	return new Promise((resolve, reject) => {
		fs$1.symlink(target, path, err => {
			err ? reject(err) : resolve();
		});
	});
}

function size(bytes) {
	{
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}

const fs = require("fs");
const path = require("path");
const {shell} = require("electron").remote;

function statsToMetadata(stats) {
	return {
		isDirectory: stats.isDirectory(),
		isSymbolicLink: stats.isSymbolicLink(),
		date: stats.mtime,
		size: stats.size,
		mode: stats.mode
	}
}

function getMetadata(path, options = {}) {
	return new Promise((resolve, reject) => {
		let cb = (err, stats) => {
			if (err) { 
				reject(err);
			} else {
				resolve(statsToMetadata(stats));
			}
		};
		options.link ? fs.lstat(path, cb) : fs.stat(path, cb);
	});
}


class Local extends Path {
	static match(str) { return str.match(/^\//); }

	constructor(p) {
		super();
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	toString() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { return this._meta.isDirectory ? "folder.png" : "file.png"; }
	exists() { return ("isDirectory" in this._meta); }

	/* symlink-specific */
	isSymbolicLink() { return this._meta.isSymbolicLink; }
	getTarget() { return this._target; }

	getDescription() {
		let d = this._path;
		/* fixme relativni */
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }

		if (!this._meta.isDirectory) {
			let size$$1 = this.getSize();
			/* fixme vynuceny vypnuty autoformat */
			if (size$$1 !== undefined) { d = `${d}, ${size(size$$1)} bytes`; }
		}
		return d;
	}
 
	getParent() {
		let parent = new this.constructor(path.dirname(this._path));
		return (parent.is(this) ? null : parent);
	}

	supports(what) { 
		switch (what) {
			case CHILDREN:
			case CREATE:
				return this._meta.isDirectory;
			break;

			case VIEW:
			case EDIT:
				return !this._meta.isDirectory;
			break;

			case RENAME:
			case DELETE:
				return true;
			break;
		}
	}

	activate(list) {
		if (this.supports(CHILDREN)) {
			return super.activate(list);
		} else {
			shell.openItem(this._path);
		}
	}

	append(leaf) {
		let newPath = path.resolve(this._path, leaf);
		return new this.constructor(newPath);
	}

	async create(opts = {}) {
		if (opts.link) {
			return symlink(opts.link, this._path);
		} else if (opts.dir) {
			return mkdir(this._path);
		} else {
			let handle = await open(this._path, "wx", opts.mode);
			return close(handle);
		}
	}

	async rename(newPath) {
		return rename(this._path, newPath.toString());
	}

	async delete() {
		return (this._meta.isDirectory ? rmdir(this._path) : unlink(this._path));
	}

	async setDate(date$$1) {
		let ts = date$$1.getTime()/1000;
		return utimes(this._path, ts, ts);
	}

	async getChildren() {
		let names = await readdir(this._path);
		let paths = names
			.map(name => path.resolve(this._path, name))
			.map(name => new this.constructor(name));

		let promises = paths.map(path => path.stat());
		await Promise.all(promises);

		return paths;
	}

	createStream(type, opts) {
		switch (type) {
			case "r": return fs.createReadStream(this._path, opts); break;
			case "w": return fs.createWriteStream(this._path, opts); break;
			default: throw new Error(`Unknown stream type "${type}"`); break;
		}
	}

	async stat() {
		try {
			this._meta = await getMetadata(this._path, {link:true});
		} catch (e) {
			this._meta = {};
		}

		if (!this._meta.isSymbolicLink) { return; }

		/* symlink: get target path (readlink), get target metadata (stat), merge directory flag */
		try {
			let targetPath = await readlink(this._path); // fixme readlink prevede na absolutni, to je spatne
			this._target = targetPath;

			/*
			 FIXME: k symlinkum na adresare povetsinou neni duvod chovat se jako k adresarum (nechceme je dereferencovat pri listovani/kopirovani...).
			 Jedina vyjimka je ikonka, ktera si zaslouzi vlastni handling, jednoho dne.
			 */
			return;

			/* we need to get target isDirectory flag */
			return getMetadata(this._target, {link:false}).then(meta => {
				this._meta.isDirectory = meta.isDirectory;
			}, e => { /* failed to stat link target */
				delete this._meta.isDirectory;
			});

		} catch (e) { /* failed to readlink */
			this._target = e;
		}
	}
}

const background = "#e8e8e8";

/* Progress window - remote (data) part */

const remote$1 = require("electron").remote;
const windowOptions = {
	parent: remote$1.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	center: true,
	width: 500,
	height: 60,
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
let storage$1 = []; // strings




function list() { return storage$1; }


function remove(index) { storage$1[index] = null; }

class Favorite extends Path {
	constructor(path, index) {
		super();
		this._path = path;
		this._index = index;
	}

	toString() { return this._path.toString(); }
	getName() { return this.toString(); }
	getSize() { return this._index; }
	getImage() { return "favorite.png"; }

	supports(what) {
		if (what == DELETE) { return true; }
		return false;
	}

	delete() {
		remove(this._index);
	}

	activate(list$$1) {
		list$$1.setPath(this._path);
	}
}

class Favorites extends Path {
	static match(str) { return str.match(/^fav:/i); }

	toString() { return "fav:"; }
	getName() { return "Favorites"; }
	supports(what) {
		if (what == CHILDREN) { return true; }
		return false;
	}

	getChildren() {
		return list().map((path, index) => {
			return path ? new Favorite(path, index) : null;
		}).filter(path => path);
	}
}

const {app} = require("electron").remote;
const ALL = [Favorites, Local];

function fromString(str) {
	let ctors = ALL.filter(ctor => ctor.match(str));
	if (!ctors.length) { throw new Error(`No Path available to handle "${str}"`); }
	let Ctor = ctors.shift();
	return new Ctor(str);
}

/* Text viewer window - local (ui) part */

const electron = require("electron");
let buffer = new Buffer(0);

electron.ipcRenderer.on("path", (e, data) => {
	let path = fromString(data);
	let stream = path.createStream("r");

	stream.on("data", part => {
		buffer = Buffer.concat([buffer, part]);
		document.querySelector("textarea").value = buffer;
	});
});

register("window:close", "Escape", () => {
	window.close();
});

}());
