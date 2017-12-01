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

const storage = Object.create(null);

function publish(message, publisher, data) {
	let subscribers = storage[message] || [];
	subscribers.forEach(subscriber => {
		typeof(subscriber) == "function"
			? subscriber(message, publisher, data)
			: subscriber.handleMessage(message, publisher, data);
	});
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

const CHILDREN = 0; // list children
const CREATE   = 1; // create descendants
const READ     = 2; // can we read contents?
const WRITE    = 3; // can we rename / modify contents?

/*
export const EDIT     = 2; // edit file via the default text editor
export const RENAME   = 3; // quickedit or attempt to move (on a same filesystem)
export const DELETE   = 4; // self-explanatory
export const COPY     = 5; // copy from FIXME pouzivat pro detekci
export const VIEW     = 6; // view using an internal viewer
*/
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

function size(bytes, options = {}) {
	{
		return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
	}
}

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

const SIZE = 16;
const THEME = faenza;

const LOCAL = ["link"];

const KEYWORD = {
	"folder": {
		type: "place",
		name: "folder"
	},
	"file": {
		type: "mime",
		name: "text-plain"
	},
	"up": {
		type: "action",
		name: "go-up"
	},
	"favorite": {
		type: "emblem",
		name: "emblem-favorite"
	},
	"broken": {
		type: "action",
		name: "gtk-cancel"
	}
};

let cache = Object.create(null);
let link = null;

async function createImage(src) {
	let img = node("img", {src});
	return new Promise((resolve, reject) => {
		img.onload = e => resolve(img);
		img.onerror = reject;
	});
}

function createCacheKey(name, options) {
	return `${name}${options.link ? "-link" : ""}`;
}

function nameToPath(name) {
	let path;
	if (name.indexOf("/") == -1) { // keyword
		if (LOCAL.indexOf(name) > -1) { return `../img/${name}.png`; } // local image
		path = KEYWORD[name]; // keyword-to-mimetype mapping
	} else {
		path = {name, type:"mime"};
	}
	return THEME.formatPath(path);
}

async function createIcon(name, options) {
	let canvas = node("canvas", {width:SIZE, height:SIZE});
	let ctx = canvas.getContext("2d");

	let path = nameToPath(name);
	let image;

	try {
		image = await createImage(path);
	} catch (e) {
		console.warn("No icon found for", name);
		image = await createImage(nameToPath("file"));
	}

	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
	if (options.link) {
		if (!link) { 
			link = await createIcon("link", {link:false});
		}
		ctx.drawImage(link, 0, SIZE - link.height);
	}

	return canvas;
}

function drawCached(canvas, cached) {
	canvas.width = cached.width;
	canvas.height = cached.height;
	canvas.getContext("2d").drawImage(cached, 0, 0);
}

function create(name, options = {}) {
	let canvas = node("canvas", {width:SIZE, height:SIZE});
	let key = createCacheKey(name, options);

	if (key in cache) { // cached image or Promise
		let cached = cache[key];
		if (cached instanceof Promise) { // cached Promise
			cached.then(icon => drawCached(canvas, icon));
		} else { // cached image
			drawCached(canvas, cached);
		}
	} else { // cache empty
		let cached = createIcon(name, options).then(icon => cache[key] = icon);
		cache[key] = cached;
		cached.then(icon => drawCached(canvas, icon));
	}

	return canvas;
}

const mime = require("mime");

function getType(str) {
	let mt = mime.getType(str);
	if (mt) { return mt; }

	if (str.match(/\.py$/i)) { return "text/x-python"; }

	return "file";
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
		this._target = null; // string, relative or absolute; null when failed to readlink
		this._targetPath = null; // Local, absolute, for icon resolution, might not exist
		this._error = null;
		this._meta = {};
	}

	toString() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() {
		let mimeType = getType(this.toString()) || "file"; 

		let link = this._meta.isSymbolicLink;
		let name = mimeType; // regular file

		if (link) {
			if (!this._targetPath || !this._targetPath.exists()) { // unreadable/broken symlink
				name = "broken";
			} else if (this._targetPath.supports(CHILDREN)) { // symlink to existing directory
				name = "folder";
			}
		} else if (this.supports(CHILDREN)) { // regular directory
			name = "folder";
		}

		return create(name, {link});
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
			let size$$1 = this.getSize();
			/* force raw bytes, no auto units */
			if (size$$1 !== undefined) { d = `${d}, ${size(size$$1, {auto:false})} bytes`; }
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

			case READ:
			case WRITE:
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

let storage$1 = []; // strings
let root = null; // root fav: path




function list() { return storage$1; }


function remove(index) { 
	storage$1[index] = null;
	publish("path-change", null, {path:root});
}

class Favorite extends Path {
	constructor(path, index) {
		super();
		this._path = path;
		this._index = index;
	}

	toString() { return this._path.toString(); }
	getName() { return this.toString(); }
	getSize() { return this._index; }
	getImage() { return create("favorite"); }
	getSort() { return (this._index == 0 ? 10 : this._index); }

	supports(what) {
		if (what == WRITE) { return true; }
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
