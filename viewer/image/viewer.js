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

const CHILDREN = 0; // list children
const CREATE = 1; // create descendants
const EDIT = 2; // edit file via the default text editor
const RENAME = 3; // quickedit or attempt to move (on a same filesystem)
const DELETE = 4; // self-explanatory
 // copy from FIXME pouzivat pro detekci
const VIEW = 6; // view using an internal viewer

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
	getSort() { return (this.supports(CHILDREN) ? 1 : 2); }
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

const fs$1 = require("fs");

function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs$1.readlink(linkPath, (err, target) => {
			err ? reject(err) : resolve(target);
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

function size$1(bytes, options = {}) {
	{
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}

let images = Object.create(null);
let cache = Object.create(null);

function createCacheKey(name, options) {
	return `${name}${options.link ? "-link" : ""}`;
}

function serialize(canvas) {
	let url = canvas.toDataURL();

	let binStr = atob(url.split(",").pop());
	let len = binStr.length;
	let arr = new Uint8Array(len);
	for (let i=0; i<len; i++) { arr[i] = binStr.charCodeAt(i); }

    let blob = new Blob([arr], {type: "image/png"});
	return URL.createObjectURL(blob);
}

function createIcon(name, options) {
	let image = images[name];
	let canvas = node("canvas", {width:image.width, height:image.height});

	let ctx = canvas.getContext("2d");

	ctx.drawImage(image, 0, 0);
	if (options.link) {
		let link = images["link"];
		ctx.drawImage(link, 0, image.height - link.height);
	}

	return serialize(canvas);
}



function get(name, options = {}) {
	let key = createCacheKey(name, options);
	if (!(key in cache)) { cache[key] = createIcon(name, options); }
	return cache[key];
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
		this._path = path.resolve(p); // to get rid of a trailing slash
		this._target = null; // string, relative or absolute
		this._targetPath = null; // Local, absolute, for icon resolution
		this._error = null;
		this._meta = {};
	}

	toString() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { 
		let link = this._meta.isSymbolicLink;
		let name;

		if (link) {
			name = (this._targetPath && this._targetPath.supports(CHILDREN) ? "folder" : "file");
		} else {
			name = (this._meta.isDirectory ? "folder" : "file");
		}

		return get(name, {link});
	}
	exists() { return ("isDirectory" in this._meta); }

	getSort() {
		if (this._meta.isSymbolicLink && this._targetPath) {
			return this._targetPath.getSort();
		} else {
			return super.getSort();
		}
	}

	/* symlink-specific */
	isSymbolicLink() { return this._meta.isSymbolicLink; }
	getTarget() { return this._target; }

	getDescription() {
		let d = this._path;
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }

		if (!this._meta.isDirectory) {
			let size = this.getSize();
			/* force raw bytes, no auto units */
			if (size !== undefined) { d = `${d}, ${size$1(size, {auto:false})} bytes`; }
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

		// symlink: get target path (readlink), get target metadata (stat)
		try {
			let target = await readlink(this._path);
			this._target = target;

			// resolve relative path
			let linkDir = path.dirname(this._path);
			target = path.resolve(linkDir, target);

			let targetPath = new Local(target);
			this._targetPath = targetPath;

			await targetPath.stat();

		} catch (e) {} // failed to readlink
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
	getImage() { return get("favorite"); }

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

/* Image viewer window - local (ui) part */

const electron = require("electron");
const SCALES = [1/40, 1/30, 1/20, 1/16, 1/12, 1/10, 1/8, 1/6, 1/4, 1/3, 1/2, 2/3, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 30, 40];
const image = document.querySelector("img");

let scale = null;
let size = null;
let position = null;

let currentIndex = -1;
let allImages = [];

function syncSize() {
	if (!image.complete) { return; }
	let box = image.parentNode;
	let avail = [box.offsetWidth, box.offsetHeight];
	size = [image.naturalWidth, image.naturalHeight];

	if (scale === null) { /* auto size */
		let rx = size[0]/avail[0];
		let ry = size[1]/avail[1];
		let r = Math.max(rx, ry);
		if (r > 1) { 
			size[0] /= r;
			size[1] /= r;
		}
	} else {
		let coef = SCALES[scale];
		size[0] *= coef;
		size[1] *= coef;
	}
	
	position = [
		(avail[0]-size[0])/2,
		(avail[1]-size[1])/2
	];

	image.style.width = `${Math.round(size[0])}px`;
	image.style.height = `${Math.round(size[1])}px`;
	image.style.left = `${Math.round(position[0])}px`;
	image.style.top = `${Math.round(position[1])}px`;

	let percent = Math.round(100*(size[0]/image.naturalWidth));
	let win = electron.remote.getCurrentWindow();
	let path = allImages[currentIndex];
	win.setTitle(`(${percent}%) ${path}`);

	document.querySelector(".scale").textContent = `${percent}%`;
}

function findScale(diff) {
	let frac = size[0]/image.naturalWidth;
	let index = (diff > 0 ? 0 : SCALES.length-1);
		
	while (index >= 0 && index < SCALES.length) {
		if (diff * (SCALES[index] - frac) > 0) { return index; }
		index += diff;
	}

	return null;
}

function zoom(diff) {
	if (scale === null) {
		scale = findScale(diff);
		syncSize();
	} else {
		let s = scale + diff;
		if (s >= 0 && s+1 < SCALES.length) {
			scale = s;
			syncSize();
		}
	}
}

function moveBy(diff) {
	let amount = 20;
	let props = ["left", "top"];
	let box = image.parentNode;
	let avail = [box.offsetWidth, box.offsetHeight];
	props.forEach((prop, i) => {
		let pos = position[i];
		if (pos > 0) { return; } /* centered */
		
		pos += diff[i]*amount;
		pos = Math.min(pos, 0);
		pos = Math.max(pos, avail[i]-size[i]);
		position[i] = pos;
		image.style[prop] = `${Math.round(pos)}px`;
	});
}

function onMouseMove(e) {
	if (!image.complete) { return; }
	let frac = image.naturalWidth / size[0];
	let pos = [e.clientX, e.clientY]
		.map((mouse, i) => frac*(mouse - position[i]))
		.map(Math.round);

	document.querySelector(".mouse").textContent = pos.join(",");
}

function loadAnother(diff) {
	let index = currentIndex + diff;
	index = Math.max(index, 0);
	index = Math.min(index, allImages.length-1);
	if (index != currentIndex) { load(index); }
}

function onLoad(e) {
	document.body.classList.remove("loading");
	document.querySelector(".size").textContent = [image.naturalWidth, image.naturalHeight].join("×");
	syncSize();
}

function load(i) {
	currentIndex = i;
	scale = null;
	document.body.classList.add("loading");
	image.src = allImages[currentIndex].toString();
}

electron.ipcRenderer.on("path", (e, all, i) => {
	allImages = all.map(fromString);
	load(i);
});

image.addEventListener("load", onLoad);
window.addEventListener("resize", syncSize);
window.addEventListener("mousemove", onMouseMove);

register("window:close", "Escape", () => {
	window.close();
});

register("image:zoomin", "+", () => zoom(+1));
register("image:zoomout", "-", () => zoom(-1));
register("image:fit", "*", () => {
	scale = null;
	syncSize();
});

register("image:left", "ArrowLeft", () => moveBy([1, 0]));
register("image:right", "ArrowRight", () => moveBy([-1, 0]));
register("image:up", "ArrowUp", () => moveBy([0, 1]));
register("image:down", "ArrowDown", () => moveBy([0, -1]));

register("image:full", "Enter", () => {
	let win = electron.remote.getCurrentWindow();
	win.setFullScreen(!win.isFullScreen());
	syncSize();
});

register("image:next", ["PageDown", " "], () => loadAnother(+1));
register("image:prev", ["PageUp", "Backspace"], () => loadAnother(-1));
register("image:prev", "Home", () => loadAnother(-Infinity));
register("image:prev", "End", () => loadAnother(+Infinity));

}());
