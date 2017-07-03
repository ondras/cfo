(function () {
'use strict';

let issues = [];
let progresses = [];
let current = null;

function sync() {
	let active = null;
	if (progresses.length) { active = progresses[0]; }
	if (issues.length) { active = issues[0]; }
	if (current && current != active) { current.hide(); }
	current = active;
	if (current) { current.show(); }
}

function addIssue(window) {
	issues.unshift(window);
	sync();
}

function removeIssue(window) {
	let index = issues.indexOf(window);
	issues.splice(index, 1);
	if (current == window) { current = null; } // will hide/close itself
	sync();
}

function addProgress(window) {
	progresses.unshift(window);
	sync();
}

function removeProgress(window) {
	let index = progresses.indexOf(window);
	progresses.splice(index, 1);
	if (current == window) { current = null; } // will hide/close itself
	sync();
}

/* Progress window - remote (data) part */

const remote$1 = require("electron").remote;
const TIMEOUT = 1000/30; // throttle updates to once per TIMEOUT

const windowOptions = {
	parent: remote$1.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	center: true,
	width: 500,
	height: 60,
	show: false,
	useContentSize: true
};

class Progress {
	constructor(config) {
		this._config = config;
		this._data = {};
		this._window = null;
		this._timeout = null;
	}

	open() {
		let options = Object.assign({}, windowOptions, {title: this._config.title});
		this._window = new remote$1.BrowserWindow(options);
		this._window.loadURL(`file://${__dirname}/progress.html`);

		let webContents = this._window.webContents;
		webContents.once("did-finish-load", () => {
			// fixme can throw when called after the window is closed
			webContents.send("config", this._config);
			webContents.send("data", this._data);
		});

		this._window.on("closed", () => {
			if (!this._window) { return; } // closed programatically, ignore
			removeProgress(this._window);
			this._window = null;
			this.onClose();
		});

		addProgress(this._window);
	}

	close() {
		let w = this._window;
		if (!w) { return; }
		removeProgress(w);
		this._window = null;
		w.destroy();
	}

	update(data) {
		Object.assign(this._data, data);
		if (!this._window || this._timeout) { return; }

		this._timeout = setTimeout(() => {
			// fixme can throw when called after the window is closed (but before the "closed" event) 
			this._timeout = null;
			this._window && this._window.webContents.send("data", this._data);
		}, TIMEOUT);
	}

	onClose() {}
}

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
	useContentSize: true
};

class Issue {
	constructor(config) {
		this._config = config;
		this._window = null;
		this._resolve = null;
	}

	open() {
		let options = Object.assign({}, windowOptions$1, {title: this._config.title});
		this._window = new remote$2.BrowserWindow(options);
		this._window.loadURL(`file://${__dirname}/issue.html`);

		let webContents = this._window.webContents;
		webContents.once("did-finish-load", () => {
			// fixme can throw when called after the window is closed
			webContents.send("config", this._config);
		});

		remote$2.ipcMain.once("action", (e, action) => {
			let w = this._window;
			removeIssue(w);
			this._window = null;
			w.close();
			this._resolve(action);
		});

		this._window.on("closed", () => {
			if (!this._window) { return; } // closed programatically, ignore
			removeIssue(this._window);
			this._window = null;
			this._resolve("abort");
		});

		addIssue(this._window);
		return new Promise(resolve => this._resolve = resolve);
	}
}

const TIMEOUT$1 = 500;

class Operation {
	constructor() {
		this._timeout = null;
		this._progress = null;
		this._aborted = false;
		this._issues = {}; // list of potential issues and user resolutions
	}

	async run() {
		this._timeout = setTimeout(() => this._showProgress(), TIMEOUT$1);
	}

	abort() {
		this._aborted = true;
	}

	_end() {
		clearTimeout(this._timeout);
		this._progress && this._progress.close();
	}

	_showProgress() {
		this._progress && this._progress.open();
	}

	async _processIssue(type, config) {
		if (type in this._issues) {
			return this._issues[type];
		} else {
			let issue = new Issue(config);
			let result = await issue.open();
			if (result.match("-all")) { this._issues[type] = result; } // remember for futher occurences
			return result;
		}
	}
}

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
	getDescription() {}
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

function createRecord(path) {
	return {
		path,
		children: null,
		count: 1,
		size: 0
	};
}

class Scan extends Operation {
	constructor(path) {
		super();

		this._path = path;

		let options = {
			title: "Directory scan in progress",
			row1: "Scanning:",
			progress1: ""
		};
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();
	}

	async run() {
		super.run(); // schedule progress window
		let result = await this._analyze(this._path);
		this._end();
		return result;
	}

	async _analyze(path) {
		if (this._aborted) { return null; }
		this._progress.update({row1: path.toString()});

		await path.stat();

		if (path.supports(CHILDREN)) { /* descend, recurse */
			return this._analyzeDirectory(path);
		} else { /* compute */
			return this._analyzeFile(path);
		}
	}

	async _analyzeDirectory(path) {
		try {
			let record = createRecord(path);
			record.children = [];

			let children = await path.getChildren();
			let promises = children.map(childPath => this._analyze(childPath));
			children = await Promise.all(promises);

			children.forEach(child => {
				record.children.push(child);
				if (!child) { return; }
				record.count += child.count;
				record.size += child.size;
			});
			return record;
		} catch (e) {
			return this._handleError(e, path);
		}
	}

	_analyzeFile(path) {
		let record = createRecord(path);
		record.size = record.path.getSize();
		return record;
	}

	async _handleError(e, path) {
		let text = e.message;
		let title = "Error reading file/directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("scan", { text, title, buttons });

		switch (result) {
			case "retry": return this._analyze(path); break;
			case "abort": this.abort(); return null; break;
			default: return null; break;
		}
	}
}

function clear(node) {
	node.innerHTML = "";
}

function text(t) {
	return document.createTextNode(t);
}

function node(name, attrs = {}, content = "") {
	let n = document.createElement(name);
	content && n.appendChild(text(content));
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

class QuickEdit {
	constructor() {
		this._resolve = null;
		this._oldValue = "";

		this._input = node("input", {type:"text"});
		this._input.addEventListener("keydown", this);
	}

	start(value, cell) {
		this._oldValue = value; /* remember so we can put it back on escape */

		let image = cell.querySelector("img");
		while (image.nextSibling) {
			image.nextSibling.parentNode.removeChild(image.nextSibling);
		}

		let width = cell.offsetWidth - image.offsetWidth;

		cell.appendChild(this._input);
		this._input.style.width = `${width}px`;

		this._input.value = value;
		this._input.focus();
		this._input.selectionStart = 0;

		let r = value.match(/\.[^\.]+$/);
		let len = value.length;
		this._input.selectionEnd = (r && r[0] != value ? len-r[0].length : len);

		return new Promise(resolve => this._resolve = resolve);
	}

	stop() {
		if (!this._resolve) { return; }

		this._input.parentNode.replaceChild(text(this._oldValue), this._input);
		this._resolve = null;
	}

	handleEvent(e) {
		e.stopPropagation();

		switch (e.key) {
			case "Enter":
				this._resolve(this._input.value);
				this.stop();
			break;

			case "Escape":
				this.stop();
			break;
		}
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
	toString() { return this._path.toString(); }
	activate(list) { list.setPath(this._path); }

	supports(what) {
		return (what == CHILDREN);
	}
}

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
	console.log(e);
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

let resolve;

const body = document.body;
const form = node("form", {id:"confirm", className:"dialog"});
const text$1 = node("p");
const ok = node("button", {type:"submit"}, "OK");
const cancel = node("button", {type:"button"}, "Cancel");

form.appendChild(text$1);
form.appendChild(ok);
form.appendChild(cancel);

form.addEventListener("submit", e => {
	e.preventDefault();
	close$1(true);
});

cancel.addEventListener("click", e => {
	close$1(false);
});

function onKeyDown(e) {
	if (e.key == "Escape") { close$1(false); }
	e.stopPropagation();
}

function close$1(value) {
	window.removeEventListener("keydown", onKeyDown, true);
	body.classList.remove("modal");
	form.parentNode.removeChild(form);
	resolve(value);
}

function confirm(t) {
	clear(text$1);
	text$1.appendChild(text(t));

	body.classList.add("modal");
	body.appendChild(form);
	window.addEventListener("keydown", onKeyDown, true);
	ok.focus();

	return new Promise(r => resolve = r);
}

const {remote: remote$3} = require('electron');
const settings$1 = remote$3.require('electron-settings');
let storage = []; // strings

function viewFunc(i) {
	return async () => {
		console.log(i);
		let path = get(i);
		if (!path) { return; }
		getActive().getList().setPath(path);
	};
}

function setFunc(i) {
	return async () => {
		let path = getActive().getList().getPath();
		let result = await confirm(`Set "${path}" as favorite? It will be accessible as Ctrl+${i}.`);
		if (!result) { return; }
		set(path, i);
	}
}

function init$1(saved) {
	for (let i=0; i<10; i++) {
		let str = saved[i];
		storage[i] = str ? fromString(str) : null;

		register(viewFunc(i), `Ctrl+Digit${i}`);
		register(setFunc(i), `Ctrl+Shift+Digit${i}`);
	}
}

function toJSON$1() { return storage.map(path => path && path.toString()); }
function list() { return storage; }
function set(path, index) { storage[index] = path; }
function get(index) { return storage[index]; }
function remove(index) { storage[index] = null; }

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

function home() {
	return fromString(app.getPath("home"));
}

function favorites() {
	return new Favorites();
}

const storage$1 = Object.create(null);

function publish(message, publisher, data) {
	let subscribers = storage$1[message] || [];
	subscribers.forEach(subscriber => {
		typeof(subscriber) == "function"
			? subscriber(message, publisher, data)
			: subscriber.handleMessage(message, publisher, data);
	});
}

function subscribe(message, subscriber) {
	if (!(message in storage$1)) { storage$1[message] = []; }
	storage$1[message].push(subscriber);
}

const node$1 = document.querySelector("footer");

function set$1(value) {
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

		this._prefix = ""; /* current search prefix */

		let dom = TEMPLATE.content.cloneNode(true);

		this._node = dom.querySelector(".list");
		this._scroll = dom.querySelector(".scroll");
		this._table = dom.querySelector("table");
		this._input = dom.querySelector("input");

		this._table.addEventListener("click", this);
		this._table.addEventListener("dblclick", this);

		this._quickEdit = new QuickEdit();
	}

	destroy() {

	}

	getNode() { return this._node; }
	getPath() { return this._path; }

	reload(pathToBeFocused) {
		this._pathToBeFocused = pathToBeFocused;
		this._loadPathContents(this._path);
	}

	setPath(path) {
		this._pathToBeFocused = this._path; // will try to focus it afterwards
		this._loadPathContents(path);
		publish("list-change", this);
	}

	focusInput() {
		this._input.focus();
		this._input.selectionStart = 0;
		this._input.selectionEnd = this._input.value.length;
	}

	getFocusedPath() {
		let index = this._getFocusedIndex();
		if (index == -1) { return null; }
		return this._items[index].path;
	}

	activate() {
		if (this._active) { return; }

		this._active = true;
		document.addEventListener("keydown", this);

		this._focusPath(this._pathToBeFocused, 0);
		this._pathToBeFocused = null;
		this._scroll.focus();
	}

	deactivate() {
		if (!this._active) { return; }
		this._active = false;
		document.removeEventListener("keydown", this);

		this._quickEdit.stop();

		this._pathToBeFocused = this.getFocusedPath();
		this._removeFocus();
		this._input.blur();
	}

	async startEditing() {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		let {node: node$$1, path} = this._items[index];
		let name = path.getName();

		let text$$1 = await this._quickEdit.start(name, node$$1.cells[0]);
		if (text$$1 == name || text$$1 == "") { return; }
		let newPath = path.getParent().append(text$$1);

		/* FIXME test na existenci! */
		try {
			await path.rename(newPath);
			this.reload(newPath);
		} catch (e) {
			alert(e.message);
		}

/*
		var data = _("rename.exists", newFile);
		var title = _("rename.title");
		if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
		
*/
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
				} else if (!e.ctrlKey) { // nechceme aby ctrl+l hledalo od "l"
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
				let path = fromString(this._input.value);
				this.setPath(path);
			break;

			case "Escape":
				this._input.blur();
			break;
		}
	}

	async _handleKey(key) {
		let index = this._getFocusedIndex();

		switch (key) {
			case "Home": 
				this._prefix = "";
				this._focusAt(0);
			break;

			case "End":
				this._prefix = "";
				this._focusAt(this._items.length-1);
			break;

			case "ArrowUp":
				this._prefix = "";
				this._focusBy(-1);
			break;

			case "ArrowDown":
				this._prefix = "";
				this._focusBy(+1);
			break;

			case "PageUp":
				this._prefix = "";
				this._focusByPage(-1);
			break;

			case "PageDown":
				this._prefix = "";
				this._focusByPage(+1);
			break;

			case "Enter": this._activatePath(); break;

			case " ":
				if (index == -1) { return; }
				let item = this._items[index];

				/* FIXME 
				if (this._selection.selectionContains(item)) {
					this._toggleDown();
					return;
				}
				*/

				let scan = new Scan(item.path);
				let result = await scan.run();
				if (!result) { return; }
				item.size = result.size;

				clear(item.node);
				this._buildRow(item);

				this._prefix = "";
				this._focusBy(+1);
				// FIXME this._toggleDown();
			break;

			case "Escape":
				this._prefix = "";
				if (index > -1) { this._focusAt(index); } /* redraw without prefix highlight */
			break;

			default:
				if (key.length == 1) { this._search(key.toLowerCase()); }
				return false;
			break;
		}

		return true;
	}

	async _loadPathContents(path) {
		this._path = path;

		/* FIXME stat je tu jen proto, aby si cesta v metadatech nastavila isDirectory=true (kdyby se nekdo ptal na supports) */
		await path.stat();

		try {
			let paths = await path.getChildren();
			if (!this._path.is(path)) { return; } /* got a new one in the meantime */
			this._show(paths);
		} catch (e) {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
		}
	}

	_activatePath() {
		let path = this.getFocusedPath();
		if (!path) { return; }
		path.activate(this);
	}

	_show(paths) {
		let fallbackIndex = (this._pathToBeFocused ? 0 : this._getFocusedIndex());

		this._clear();

		this._input.value = this._path;
		paths.sort(SORT);

		let parent = this._path.getParent();
		if (parent) {
			let up = new Up(parent);
			paths.unshift(up);
		}

		if (!paths.length) { return; }

		this._items = this._build(paths);

		if (this._active) {
			this._focusPath(this._pathToBeFocused, fallbackIndex);
			this._pathToBeFocused = null;
		}
	}

	_build(paths) {
		return paths.map(path => {
			let node$$1 = this._table.insertRow();
			let item = {node: node$$1, path};

			this._buildRow(item);
			return item;
		});
	}

	_buildRow(item) {
		let {node: node$$1, path} = item;

		let td = node$$1.insertCell();
		let img = node("img", {src:path.getImage()});
		td.appendChild(img);

		let name = path.getName();
		if (name) { td.appendChild(text(name)); }

		let size$$1 = path.getSize();
		if (size$$1 === undefined) { size$$1 = item.size; } /* computed value (for directories) */
		node$$1.insertCell().innerHTML = (size$$1 === undefined ? "" : size(size$$1));

		let date$$1 = path.getDate();
		node$$1.insertCell().innerHTML = (date$$1 === undefined ? "" : date(date$$1));

		let mode$$1 = path.getMode();
		node$$1.insertCell().innerHTML = (mode$$1 === undefined ? "" : mode(mode$$1));
	}

	_nodeToIndex(node$$1) {
		while (node$$1 && node$$1.nodeName.toLowerCase() != "tr") { node$$1 = node$$1.parentNode; }

		return this._items.reduce((result, item, index) => {
			return (item.node == node$$1 ? index : result);
		}, -1);
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
		if (index > -1) {
			let tr = this._items[index].node;
			tr.classList.remove("focus");

			/* remove highlight */
			let cell = tr.cells[0];
			let strong = cell.querySelector("strong");
			if (strong) { strong.parentNode.replaceChild(strong.firstChild, strong); }
		}
	}

	_focusAt(index) {
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		let oldIndex = this._getFocusedIndex();

		this._removeFocus();

		if (index > -1) { 
			let node$$1 = this._items[index].node;
			node$$1.classList.add("focus");
			scrollIntoView(node$$1, this._scroll);

			let plen = this._prefix.length;
			let name = this._items[index].path.getName();

			if (name && plen > 0) { /* highlight prefix */
				let nameL = name.toLowerCase();
				if (nameL.indexOf(this._prefix) == 0) {
					let cell = node$$1.cells[0];
					let image = cell.querySelector("img");
					clear(cell);
					cell.appendChild(image);

					let strong = node("strong", {}, name.substring(0, plen));
					cell.appendChild(strong);
					cell.appendChild(text(name.substring(plen)));
				}
			}

			set$1(this._items[index].path.getDescription());
		}
	}

	/* Focus a given path. If not available, focus a given index. */
	_focusPath(path, fallbackIndex) {
		let focusIndex = this._items.reduce((result, item, index) => {
			return (path && item.path.is(path) ? index : result);
		}, fallbackIndex);
		this._focusAt(focusIndex);
	}

	_search(ch) {
		let str = `${this._prefix}${ch}`;

		for (let i=0; i<this._items.length; i++) {
			let name = this._items[i].path.getName();
			if (!name) { continue; }
			if (name.toLowerCase().indexOf(str) == 0) { /* found! */
				this._prefix = str;
				this._focusAt(i);
				return;
			}
		}
		/* not found, nothing */
	}

	_clear() {
		this._items = [];
		this._table.innerHTML = "";
		this._prefix = "";
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

	remove(index) {
		let content = this._node.children[index];
		content.parentNode.removeChild(content);

		let li = this._list.children[index];
		li.parentNode.removeChild(li);
	}

	get selectedIndex() { return this._selectedIndex; }

	set selectedIndex(index) {
		if (index == this._selectedIndex) { return; }

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
	constructor(paths = []) {
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

		paths.forEach(path => this.addList(path));
	}

	getNode() { return this._node; }

	toJSON() {
		return this._lists.map(l => l.getPath().toString());
	}

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
		if (index > -1) { 
			index = (index + diff + this._lists.length) % this._lists.length; /* js negative modulus */
			this._tabs.selectedIndex = index;
		}
	}

	getList() {
		let index = this._tabs.selectedIndex;
		return (index > -1 ? this._lists[index] : null);
	}

	handleEvent(e) {
		activate(this);
	}

	addList(path) {
		if (!path) { /* either duplicate or home */
			let index = this._tabs.selectedIndex;
			if (index == -1) { throw new Error("Cannot add new list: no path specified and duplication is not possible"); }
			path = this._lists[index].getPath();
		}

		let list = new List();
		this._lists.push(list);

		let label = this._tabs.add(list.getNode());
		this._labels.push(label);

		this._tabs.selectedIndex = this._labels.length-1;

		list.setPath(path); 
	}

	removeList() {
		if (this._lists.length < 2) { return; }

		let index = this._tabs.selectedIndex;
		if (index == -1) { return; }

		let last = (index+1 == this._lists.length);
		this._tabs.selectedIndex = -1; /* deselect */

		this._labels.splice(index, 1);
		this._tabs.remove(index);

		let list = this._lists.splice(index, 1)[0];
		list.destroy();

		this._tabs.selectedIndex = (last ? index-1 : index);
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
}

const document$1 = window.document;
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

function execute(command) {
	return registry[command].func();
}

function menuItem(command, label) {
	let click = () => execute(command);
	let accelerator = null;
	if (command in registry) { accelerator = registry[command].key; }

	return { label, click, accelerator };
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

const PANES = [];
let index = -1;

function parsePaths(saved) {
	return saved ? saved.map(fromString) : [home()];
}

function activate(pane) {
	index = PANES.indexOf(pane);
	PANES[(index+1) % 2].deactivate();
	PANES[index].activate();
}

function getActive() {
	return PANES[index];
}

function getInactive() {
	return PANES[(index+1) % 2];
}

function init(saved) {
	let left = parsePaths(saved.left);
	PANES.push(new Pane(left));

	let right = parsePaths(saved.right);
	PANES.push(new Pane(right));

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));

	let index = saved.index || 0;
	activate(PANES[index]);
}

function toJSON() {
	return {
		index,
		left: PANES[0].toJSON(),
		right: PANES[1].toJSON()
	}
}

register$1("pane:toggle", "Tab", () => {
	let i = (index + 1) % PANES.length;
	activate(PANES[i]);
});

register$1("tab:next", "Ctrl+Tab", () => {
	getActive().adjustTab(+1);
});

register$1("tab:prev", "Ctrl+Shift+Tab", () => {
	getActive().adjustTab(-1);
});

register$1("tab:new", "Ctrl+T", () => {
	getActive().addList();
});

register$1("tab:close", "Ctrl+W", () => {
	getActive().removeList();
});


var panes = Object.freeze({
	activate: activate,
	getActive: getActive,
	getInactive: getInactive,
	init: init,
	toJSON: toJSON
});

const Menu = require('electron').remote.Menu;

function init$2() {
	const template = [
		{
			label: "&File",
			submenu: [
				menuItem("file:rename", "&Quick rename"),
				menuItem("fixme", "&View"),
				menuItem("file:edit", "&Edit"),
				menuItem("file:new", "Edit &new file"),
				menuItem("file:copy", "&Copy"),
				menuItem("file:move", "&Move"),
				menuItem("file:delete", "&Delete"),
				{type: "separator"},
				{role: "quit"}
			]
		},
		{
			label: "&Go",
			submenu: [
				menuItem("list:up", "Go to &parent"),
				menuItem("list:top", "Go to &top"),
				menuItem("fixme", "&Drive selection"),
				menuItem("fixme", "&Wi-Fi Access points"),
				menuItem("list:favorites", "&Favorites"),
				menuItem("list:home", "&Home")
			]
		},
		{
			label: "&Commands",
			submenu: [
				menuItem("directory:new", "Create &directory"),
				menuItem("tab:new", "&New tab"),
				menuItem("tab:close", "&Close tab"),
				menuItem("fixme", "&Search"),
				menuItem("fixme", "Create &archive"),
				{type: "separator"}, /* fixme sort? */
				menuItem("fixme", "O&pen console"),
				menuItem("fixme", "&Options")
			]
		},
		{
			label: "&Help",
			submenu: [
				{
					label: "&About"
				},
				menuItem("app:devtools", "Toggle &Devtools")
			]
		}
	];

	let menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

let resolve$1;

const body$1 = document.body;
const form$1 = node("form", {id:"prompt", className:"dialog"});
const text$2 = node("p");
const input = node("input", {type:"text"});
const ok$1 = node("button", {type:"submit"}, "OK");
const cancel$1 = node("button", {type:"button"}, "Cancel");

form$1.appendChild(text$2);
form$1.appendChild(input);
form$1.appendChild(ok$1);
form$1.appendChild(cancel$1);

form$1.addEventListener("submit", e => {
	e.preventDefault();
	close$2(input.value);
});

cancel$1.addEventListener("click", e => {
	close$2(false);
});

function onKeyDown$1(e) {
	if (e.key == "Escape") { close$2(null); }
	e.stopPropagation();
}

function close$2(value) {
	window.removeEventListener("keydown", onKeyDown$1, true);
	body$1.classList.remove("modal");
	form$1.parentNode.removeChild(form$1);
	resolve$1(value);
}

function prompt(t, value = "") {
	clear(text$2);
	text$2.appendChild(text(t));
	input.value = value;

	body$1.classList.add("modal");
	body$1.appendChild(form$1);
	window.addEventListener("keydown", onKeyDown$1, true);
	input.selectionStart = 0;
	input.selectionEnd = input.value.length;
	input.focus();

	return new Promise(r => resolve$1 = r);
}

class Delete extends Operation {
	constructor(path) {
		super();
		this._path = path;
		this._stats = {
			total: 0,
			done: 0
		};
	}

	async run() {
		let scan = new Scan(this._path);
		let root = await scan.run(); 
		if (!root) { return false; }

		this._stats.total = root.count;
		await this._startDeleting(root);
		this._end();
	}

	async _startDeleting(record) {
		let options = {
			title: "Deletion in progress",
			row1: "Deleting:",
			progress1: "Total:"
		};
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._delete(record);
	}

	async _delete(record) {
		if (this._aborted) { return false; }

		let deleted = true;

		if (record.children !== null) {
			for (let child of record.children) {
				let childDeleted = await this._delete(child); 
				if (!childDeleted) { deleted = false; }
			}
		}

		if (!deleted) { return false; }

		var path = record.path;
		this._progress.update({row1:path.toString(), progress1:100*this._stats.done/this._stats.total});

		try {
			await path.delete();
			this._stats.done++;
			return true;
		} catch (e) {
			return this._handleError(e, record);
		}
	}

	async _handleError(e, record) {
		let text = e.message;
		let title = "Error deleting file/directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("delete", { text, title, buttons });
		switch (result) {
			case "retry": return this._delete(record); break;
			case "abort": this.abort(); break;
		}
		return false;
	}
}

class Copy extends Operation {
	constructor(sourcePath, targetPath) {
		super();
		this._sourcePath = sourcePath;
		this._targetPath = targetPath;
		this._texts = {
			title: "Copying in progress",
			row1: "Copying:"
		};
		this._stats = {
			done: 0,
			total: 0
		};
	}

	async run() {
		let scan = new Scan(this._sourcePath);
		let root = await scan.run();
		if (!root) { return false; }

		this._stats.total = root.size;
		await this._startCopying(root);
		this._end();
	}

	async _startCopying(root) {
		let options = {
			title: this._texts.title,
			row1: this._texts.row1,
			row2: "To:",
			progress1: "File:",
			progress2: "Total:"
		};
		this._progress = new Progress(options);
		this._progress.update({progress1:0, progress2:0});
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._copy(root, this._targetPath);
	}

	/**
	 * @param {object} record Source record
	 * @param {Path} targetPath Target path without the appended part
	 */
	async _copy(record, targetPath) {
		if (this._aborted) { return; }

		await targetPath.stat();

		if (record.path.getParent().is(targetPath)) { /* copy to the same parent -- create a "copy of" prefix */
			let name = record.path.getName();
			while (targetPath.exists()) {
				name = `Copy of ${name}`;
				targetPath = record.path.getParent().append(name);
				await targetPath.stat();
			}
		} else if (targetPath.exists()) { /* append inside an existing target */
			targetPath = targetPath.append(record.path.getName());
		} /* else does not exist, will be created during copy impl below */

		if (record.children !== null) {
			await this._copyDirectory(record, targetPath);
		} else {
			await this._copyFile(record, targetPath);
		}

		await targetPath.setDate(record.path.getDate());
		return this._recordCopied(record);
	}

	/**
	 * Copy a directory record to target directory path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyDirectory(record, targetPath) {
		let created = await this._createDirectory(targetPath, record.path.getMode());
		if (!created) { return; }

		for (let child of record.children) {
			await this._copy(child, targetPath);
		}
	}

	/**
	 * @returns {Promise<bool>}
	 */
	async _createDirectory(path, mode) {
		if (path.exists() && path.supports(CHILDREN)) { return true; } /* folder already exists, fine */

		try {
			await path.create({dir:true, mode});
			return true;	
		} catch (e) {
			return this._handleCreateError(e, path, mode);
		}
	}

	/**
	 * Copy a file record to target file path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyFile(record, targetPath) {
		let progress1 = 0;
		let progress2 = 100*this._stats.done/this._stats.total;
		this._progress.update({row1:record.path.toString(), row2:targetPath.toString(), progress1, progress2});

		if (targetPath.exists()) { /* target exists: overwrite/skip/abort */
			if (this._issues.overwrite == "skip-all") { /* silently skip */
				this._stats.done += record.size;
				return;
			}
			if (this._issues.overwrite != "overwrite-all") { /* raise an issue */
				let result = await this._handleFileExists(targetPath);
				switch (result) {
					case "abort": this.abort(); return; break;
					case "skip":
					case "skip-all":
						this._stats.done += record.size;
						return;
					break;
					/* overwrite = continue */
				}
			}
		}

		if (record.path instanceof Local && record.path.isSymbolicLink()) {
			return this._copyFileSymlink(record, targetPath);
		} else {
			return this._copyFileContents(record, targetPath);
		}
	}

	async _copyFileSymlink(record, targetPath) {
		try {
			await targetPath.create({link:record.path.getTarget()});
		} catch (e) {
			return this._handleSymlinkError(e, record, targetPath);
		}
	}

	async _copyFileContents(record, targetPath) {
		let done = 0;
		let opts = { mode:record.path.getMode() };
		let readStream = record.path.createStream("r");
		let writeStream = targetPath.createStream("w", opts);
		readStream.pipe(writeStream);

		await new Promise(resolve => {
			let handleError = async e => {
				await this._handleCopyError(e, record, targetPath);
				resolve();
			};
			readStream.on("error", handleError);
			writeStream.on("error", handleError);

			writeStream.on("finish", resolve);

			readStream.on("data", buffer => {
				done += buffer.length;
				this._stats.done += buffer.length;

				let progress1 = 100*done/record.size; 
				let progress2 = 100*this._stats.done/this._stats.total;
				this._progress.update({progress1, progress2});
			}); /* on data */
		}); /* file copy promise */		
	}

	async _recordCopied(record) {} /* used only for moving */

	async _handleFileExists(path) {
		let text = `Target file ${path} already exists`;
		let title = "File exists";
		let buttons = ["overwrite", "overwrite-all", "skip", "skip-all", "abort"];
		return this._processIssue("overwrite", { text, title, buttons });
	}

	async _handleCreateError(e, path, mode) {
		let text = e.message;
		let title = "Error creating directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("create", { text, title, buttons });

		switch (result) {
			case "retry": return this._createDirectory(path, mode); break;
			case "abort": this.abort(); break;
		}

		return false;
	}

	async _handleCopyError(e, record, targetPath) {
		let text = e.message;
		let title = "Error copying file";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("copy", { text, title, buttons });
		switch (result) {
			case "retry": return this._copyFile(record, targetPath); break;
			case "abort": this.abort(); break;
		}
	}

	async _handleSymlinkError(e, record, targetPath) {
		let text = e.message;
		let title = "Error creating symbolic link";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("symlink", { text, title, buttons });
		switch (result) {
			case "retry": return this._copyFileSymlink(record, targetPath); break;
			case "abort": this.abort(); break;
		}
	}
}

class Move extends Copy {
	constructor(sourcePath, targetPath) {
		super(sourcePath, targetPath);
		this._texts = {
			title: "Moving in progress",
			row1: "Moving:"
		};
	}

	async _startCopying(root) {
		if (root.path.supports(RENAME)) {
			let targetPath = this._targetPath;
			await targetPath.stat();
			if (targetPath.exists()) { targetPath = targetPath.append(root.path.getName()); }
			try {
				await root.path.rename(targetPath);
				return;
			} catch (e) {} // quick rename failed, need to copy+delete
		}
		super._startCopying(root);
	}

	async _recordCopied(record) {
		try {
			await record.path.delete();
		} catch (e) {
			return this._handleDeleteError(e, record);
		}
	}

	async _handleDeleteError(e, record) {
		let text = e.message;
		let title = "Error deleting file";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("delete", { text, title, buttons });
		switch (result) {
			case "retry": return this._recordCopied(record); break;
			case "abort": this.abort(); break;
		}
	}
}

register$1("list:up", "Backspace", () => {
	let list = getActive().getList();
	let parent = list.getPath().getParent();
	parent && list.setPath(parent);
});

register$1("list:top", "Ctrl+Backspace", () => {
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

register$1("list:home", "Ctrl+H", () => {
	let path = home();
	getActive().getList().setPath(path);
});

register$1("list:favorites", [], () => {
	let path = favorites();
	getActive().getList().setPath(path);
});

register$1("list:input", "Ctrl+L", () => {
	getActive().getList().focusInput();
});

register$1("directory:new", "F7", async () => {
	let list = getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	let name = await prompt(`Create new directory in "${path}"`);
	if (!name) { return; }

	let newPath = path.append(name);
	
	try {
		await newPath.create({dir:true});
		list.reload(newPath);
	} catch (e) {
		alert(e.message);
	}
});

register$1("file:new", "Shift+F4", async () => {
	let list = getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	/* fixme new.txt mit jako preferenci */
	let name = await prompt(`Create new file in "${path}"`, "new.txt");
	if (!name) { return; }

	let newPath = path.append(name);
	try {
		await newPath.create({dir:false});
		list.reload(newPath);
	} catch (e) {
		alert(e.message);
	}
});

register$1("file:edit", "F4", () => {
	let file = getActive().getList().getFocusedPath();
	if (!file.supports(EDIT)) { return; }

	/* fixme configurable */
	let child = require("child_process").spawn("/usr/bin/subl", [file]);

	child.on("error", e => alert(e.message));
});

register$1("file:delete", ["F8", "Delete", "Shift+Delete"], async () => {
	let list = getActive().getList();
	let path = list.getFocusedPath();
	if (!path.supports(DELETE)) { return; }

	let result = await confirm(`Really delete "${path}" ?`);
	if (!result) { return; }
	let d = new Delete(path);
	await d.run();
	list.reload();
});

register$1("file:rename", "F2", () => {
	let list = getActive().getList();
	let file = list.getFocusedPath();
	if (!file.supports(RENAME)) { return; }
	list.startEditing();
});

register$1("file:copy", "F5", async () => {
	let sourceList = getActive().getList();
	let sourcePath = sourceList.getFocusedPath();
	let targetList = getInactive().getList();
	let targetPath = targetList.getPath();

	/* fixme parent->child test */

	let name = await prompt(`Copy "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = fromString(name);
	let copy = new Copy(sourcePath, targetPath);
	await copy.run();
	targetList.reload();
});

register$1("file:move", "F6", async () => {
	let sourceList = getActive().getList();
	let sourcePath = sourceList.getFocusedPath();
	let targetList = getInactive().getList();
	let targetPath = targetList.getPath();

	/* fixme parent->child test */

	let name = await prompt(`Move "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = fromString(name);
	let move = new Move(sourcePath, targetPath);
	await move.run();
	sourceList.reload();
	targetList.reload();
});

register$1("app:devtools", "F12", () => {
	require("electron").remote.getCurrentWindow().toggleDevTools();
});

const {remote} = require('electron');
const settings = remote.require('electron-settings');

window.FIXME = (...args) => console.error(...args);
window.sleep = (delay = 1000) => new Promise(r => setTimeout(r, delay));

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

function saveSettings(e) {
	let win = remote.getCurrentWindow();
	settings.set("window.size", win.getSize());
	settings.set("panes", toJSON());
	settings.set("favorites", toJSON$1());
}
window.addEventListener("beforeunload", saveSettings);
window.panes = panes;

init$2();
init$1(settings.get("favorites", []));
init(settings.get("panes", {}));

}());
