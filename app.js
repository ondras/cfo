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
	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
	append(leaf) {}
	create(opts) {}
	rename(newPath) {}
}

const CHILDREN = 0; // list children
const CREATE = 1; // create descendants
const EDIT = 2; // edit file via the default text editor
const RENAME = 3; // quickedit or attempt to move (on a same filesystem)

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
			if (err) { reject(err); } else { resolve(files); }
		});
	});
}

function mkdir(path, mode) {
	return new Promise((resolve, reject) => {
		fs$1.mkdir(path, mode, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

function open(path, flags, mode) {
	return new Promise((resolve, reject) => {
		fs$1.open(path, flags, mode, (err, fd) => {
			if (err) { reject(err); } else { resolve(fd); }
		});
	});
}

function close(fd) {
	return new Promise((resolve, reject) => {
		fs$1.close(fd, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

function rename(oldPath, newPath) {
	return new Promise((resolve, reject) => {
		fs$1.rename(oldPath, newPath, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
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
const {app, shell} = require("electron").remote;

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


class Local extends Path {
	static home() {
		return new this(app.getPath("home"));
	}

	constructor(p) {
		super();
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	getPath() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { return this._meta.isDirectory ? "folder.png" : "file.png"; }

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

	create(opts = {}) {
		if (opts.dir) {
			return mkdir(this._path);
		} else {
			return open(this._path, "wx").then(close);
		}
	}

	rename(newPath) {
		return rename(this._path, newPath.getPath());
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


				/*
				 FIXME: k symlinkum na adresare povetsinou neni duvod chovat se jako k adresarum (nechceme je dereferencovat pri listovani/kopirovani...).
				 Jedina vyjimka je ikonka, ktera si zaslouzi vlastni handling, jednoho dne.
				 */
				return;

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

/* Progress window - remote (data) part */

const remote = require("electron").remote;

const windowOptions = {
	parent: remote.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	center: true,
	width: 500,
	height: 60,
	useContentSize: true,
};

class Progress {
	constructor(config) {
		this._config = config;
		this._data = null;
		this._window = null;
	}

	open() {
		let options = Object.assign({}, windowOptions, {title: this._config.title});
		this._window = new remote.BrowserWindow(windowOptions);
		this._window.loadURL(`file://${__dirname}/progress.html`);

		let webContents = this._window.webContents;
		webContents.once("did-finish-load", () => {
			webContents.send("config", this._config);
			webContents.send("data", this._data);
		});
	}

	close() {
		this._window && this._window.destroy();
		this._window = null;
	}

	update(data) {
		if (this._window) {
			this._window.webContents.send("data", data);
		} else {
			this._data = data;
		}
	}
}


/**
 * Progressbar window 
 * @param {object} [data]
 * @param {string || null} [data.progress1]
 * @param {string || null} [data.progress2]
 * @param {string} [data.progress1-label]
 * @param {string} [data.progress2-label]
 * @param {string} [data.row1-label]
 * @param {string} [data.row1-value]
 * @param {string} [data.row2-label]
 * @param {string} [data.row2-value]
 * @param {string} [data.title]
 * 
 * @param {object} [mode]
 * @param {string} [mode.progress1]
 * @param {string} [mode.progress2]
 *
var Progress = function(owner, data, mode) {
	this._loaded = false;
	this._owner = owner;
	this._ec = [];
	this._data = {
		"row1-label": "",
		"row1-value": "",
		"row2-label": "",
		"row2-value": "",
		"progress1-label": "",
		"progress2-label": "",
		"progress1": 0,
		"progress2": 0
	};
	
	this._mode = {
		"progress1": "determined",
		"progress2": "determined"
	}
	for (var p in mode) { this._mode[p] = mode[p]; }
	
	this.update(data);
	this._win = window.openDialog("progress/progress.xul", "", "chrome,centerscreen");

	this._win.addEventListener("load", this);
	this._win.addEventListener("dialogcancel", this);
}

Progress.prototype.handleEvent = function(e) {
	switch (e.type) {
		case "load":
			this._loaded = true;
			
			var doc = this._win.document;
			for (var id in this._mode) { doc.getElementById(id).mode = this._mode[id]; }
			
			this._sync(this._data);
			this._win.sizeToContent();
		break;

		case "dialogcancel":
			this._win = null;
			this._owner.abort();
		break;
	}
}

Progress.prototype.update = function(data) {
	if (this._loaded) {
		this._sync(data);
	} else {
		for (var p in data) { this._data[p] = data[p]; }
	}
}

Progress.prototype.close = function() {
	if (!this._win) { return; }

	this._win.close();
	this._win = null;
}

Progress.prototype.focus = function() {
	this._win.focus();
}

Progress.prototype._sync = function(data) {
	if (!this._win) { return; }
	
	var doc = this._win.document;
	if (data.title) { doc.title = data.title; }
	
	for (var p in data) {
		if (p == "title") { 
			doc.title = data[p]; 
		} else {
			var value = data[p];
			var elm = doc.getElementById(p);
			if (value === null) {
				elm.style.display = "none";
			} else {
				elm.style.display = "";
				elm.value = value;
			}
		}
	}
}
*/

const TIMEOUT = 50;

class Operation {
	constructor() {
		this._timeout = null;
		this._progress = null;
	}

	run() {
		this._timeout = setTimeout(() => this._showProgress(), TIMEOUT);
		return Promise.resolve();
	}

	_end(result) {
		clearTimeout(this._timeout);
		this._progress && this._progress.close();
		return result;
	}

	_showProgress() {
		this._progress && this._progress.open();
	}
}

function createRecord(path, parent) {
	return {
		path,
		parent,
		children: [],
		count: 1,
		size: 0
	};
}

class Scan extends Operation {
	constructor(path) {
		super();

		this._root = createRecord(path, null);

		let options = {
			title: "Directory scanning…",
			row1: "Scanning:",
			progress1: " "
		};
		this._progress = new Progress(options);
	}

	run() {
		super.run();
		return this._analyze(this._root).then(x => this._end(x));
	}

	_analyze(record) {
		this._progress.update({row1: record.path.getPath()});

		if (record.path.supports(CHILDREN)) { /* descend, recurse */
			return this._analyzeDirectory(record).then(x => {
				return new Promise(resolve => setTimeout(() => resolve(x), 150));
			});
		} else { /* compute */
			return this._analyzeFile(record);
		}
	}

	_analyzeDirectory(record) {
		return record.path.getChildren().then(children => {
			record.children = children.map(ch => createRecord(ch, record));
			let promises = record.children.map(r => this._analyze(r));
			return Promise.all(promises).then(() => record); /* fulfill with the record */
		}); /* fixme reject */
	}

	_analyzeFile(record) {
		return record.path.stat().then(() => {
			record.size = record.path.getSize(); /* update this one */

			let current = record;
			while (current.parent) { /* update all parents */
				current.parent.count += record.count;
				current.parent.size += record.size;
				current = current.parent;
			}

			return record;
		}); /* fixme reject */
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
	getPath() { return this._path.getPath(); }
	activate(list) { list.setPath(this._path); }

	supports(what) {
		return (what == CHILDREN);
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

		this._focusPath(this._pathToBeFocused);
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

	startEditing() {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		let {node: node$$1, path} = this._items[index];
		let name = path.getName();

		this._quickEdit.start(name, node$$1.cells[0]).then(text$$1 => {
			if (text$$1 == name || text$$1 == "") { return; }
			let newPath = path.getParent().append(text$$1);

			/* FIXME test na existenci! */
			path.rename(newPath).then(
				() => this.reload(newPath),
				e => alert(e.message)
			);

/*
			var data = _("rename.exists", newFile.getPath());
			var title = _("rename.title");
			if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
			
			try {
				item.rename(newFile);
				this.resync(newFile);
			} catch (e) {
				var data = _("error.rename", item.getPath(), newFile.getPath(), e.message);
				this._fc.showAlert(data);
			}
*/
		});
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

				new Scan(item.path).run().then(result => {
					if (!result) { return; }
					item.size = result.size;

					clear(item.node);
					this._buildRow(item);

					this._prefix = "";
					this._focusBy(+1);
					// FIXME this._toggleDown();
				});
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

	_loadPathContents(path) {
		this._path = path;
		/* FIXME stat je tu jen proto, aby si cesta v metadatech nastavila isDirectory=true (kdyby se nekdo ptal na supports) */
		return path.stat().then(() => path.getChildren()).then(paths => {
			if (!this._path.is(path)) { return; } /* got a new one in the meantime */
			this._show(paths);
		}, e => {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
		});
	}

	_activatePath() {
		let path = this.getFocusedPath();
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

			set(this._items[index].path.getDescription());
		}
	}

	_focusPath(path) {
		let focusIndex = this._items.reduce((result, item, index) => {
			return (path && item.path.is(path) ? index : result);
		}, 0);
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

		this.addList();
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
			path = (index == -1 ? Local.home() : this._lists[index].getPath());
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

		if (reg.key != e.key.toLowerCase()) { return false; }

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

register$$1("tab:new", "Ctrl+T", () => {
	getActive().addList();
});

register$$1("tab:close", "Ctrl+W", () => {
	getActive().removeList();
});

let resolve;

const body = document.body;
const form = node("form", {id:"prompt"});
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

function prompt(t, value = "") {
	clear(text$1);
	text$1.appendChild(text(t));
	input.value = value;

	body.classList.add("modal");
	body.appendChild(form);
	window.addEventListener("keydown", onKeyDown, true);
	input.selectionStart = 0;
	input.selectionEnd = input.value.length;
	input.focus();

	return new Promise(r => resolve = r);
}

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
	let home = Local.home();
	getActive().getList().setPath(home);
});

register$$1("list:input", "Ctrl+L", () => {
	getActive().getList().focusInput();
});

register$$1("directory:new", "F7", () => {
	let list = getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	prompt(`Create new directory in "${path.getPath()}"`).then(name => {
		if (!name) { return; }

		let newPath = path.append(name);
		newPath.create({dir:true}).then(
			() => list.reload(newPath),
			e => alert(e.message)
		);
	});
});

register$$1("file:new", "Shift+F4", () => {
	let list = getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	/* fixme new.txt mit jako preferenci */
	prompt(`Create new file in "${path.getPath()}"`, "new.txt").then(name => {
		if (!name) { return; }

		let newPath = path.append(name);
		newPath.create({dir:false}).then(
			() => list.reload(newPath),
			e => alert(e.message)
		);
	});
});

register$$1("file:edit", "F4", () => {
	let file = getActive().getList().getFocusedPath();
	if (!file.supports(EDIT)) { return; }

	/* fixme configurable */
	let child = require("child_process").spawn("/usr/bin/sublx", [file.getPath()]);

	child.on("error", e => alert(e.message));
});

register$$1("file:rename", "F2", () => {
	let list = getActive().getList();
	let file = list.getFocusedPath();
	if (!file.supports(RENAME)) { return; }
	list.startEditing();
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
