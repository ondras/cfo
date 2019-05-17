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

	const background = "#e8e8e8";

	/* Progress window - remote (data) part */

	const remote = require("electron").remote;
	const TIMEOUT = 1000/30; // throttle updates to once per TIMEOUT

	const windowOptions = {
		resizable: false,
		fullscreenable: false,
		center: true,
		width: 500,
		height: 100,
		show: false,
		useContentSize: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
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
			options.parent = remote.getCurrentWindow();
			this._window = new remote.BrowserWindow(options);
			this._window.setMenu(null);
			this._window.loadURL(`file://${__dirname}/../progress/index.html`);

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

	const remote$1 = require("electron").remote;
	const windowOptions$1 = {
		resizable: false,
		fullscreenable: false,
		alwaysOnTop: true,
		center: true,
		width: 500,
		height: 60,
		show: false,
		useContentSize: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
	};

	class Issue {
		constructor(config) {
			this._config = config;
			this._window = null;
			this._resolve = null;
		}

		open() {
			let options = Object.assign({}, windowOptions$1, {title: this._config.title});
			options.parent = remote$1.getCurrentWindow();
			this._window = new remote$1.BrowserWindow(options);
			this._window.setMenu(null);
			this._window.loadURL(`file://${__dirname}/../issue/index.html`);

			let webContents = this._window.webContents;
			webContents.once("did-finish-load", () => {
				// fixme can throw when called after the window is closed
				webContents.send("config", this._config);
			});

			remote$1.ipcMain.once("action", (e, action) => {
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

	const CHILDREN = 0; // list children
	const CREATE   = 1; // create descendants (FIXME APPEND?)
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

	const promisify = require("util").promisify;
	const fs = require("fs");

	const readlink = promisify(fs.readlink);
	const readdir = promisify(fs.readdir);
	const mkdir = promisify(fs.mkdir);
	const rmdir = promisify(fs.rmdir);
	const open = promisify(fs.open);
	const close = promisify(fs.close);
	const rename = promisify(fs.rename);
	const unlink = promisify(fs.unlink);
	const utimes = promisify(fs.utimes);
	const symlink = promisify(fs.symlink);

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

	const autoSize = get("autosize");
	const UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
	const UNIT_STEP = 1 << 10;

	function size(bytes, options = {}) {
		if (autoSize && options.auto) {
			let index = 0;
			while (bytes / UNIT_STEP >= 1 && index+1 < UNITS.length) {
				bytes /= UNIT_STEP;
				index++;
			}
			let frac = (index > 0 ? 2 : 0);
			return `${bytes.toFixed(frac)} ${UNITS[index]}`;
		} else {
			return bytes.toString().replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, "$1 ");
		}
	}

	function text(t) {
		return document.createTextNode(t);
	}

	function node(name, attrs = {}, content = "") {
		let n = document.createElement(name);
		content && n.appendChild(text(content));
		return Object.assign(n, attrs);
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
		"audio/mp4": "audio/x-generic",
		"application/vnd.apple.mpegurl": "audio/x-mpegurl"
	};

	function formatPath(path) {
		let name = path.name;
		if (name in fallback) { name = fallback[name]; }
		name = name.replace(/\//g, "-");
		return `../img/faenza/${type[path.type]}/16/${name}.png`;
	}

	var faenza = /*#__PURE__*/Object.freeze({
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
		"application/rdf+xml": "text/rdf+xml",
		"application/vnd.apple.mpegurl": "audio/x-mpegurl"
	};

	function formatPath$1(path) {
		let name = path.name;
		if (name in fallback$1) { name = fallback$1[name]; }
		name = name.replace(/\//g, "-");
		return `../img/numix/${type$1[path.type]}/${name}.svg`;
	}

	var numix = /*#__PURE__*/Object.freeze({
		formatPath: formatPath$1
	});

	const THEMES = {faenza, numix};
	const SIZE = 16;
	const THEME = THEMES[get("icons")];

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

	const fs$1 = require("fs");
	const path = require("path");
	const remote$2 = require("electron").remote;

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
			options.link ? fs$1.lstat(path, cb) : fs$1.stat(path, cb);
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
				case CHILDREN: // FIXME symlink je spis soubor nez adresar, co kdyby zde vracel false? nemusela by na nej byt vyjimka v operation.scan
				case CREATE:
					if (this._meta.isDirectory) { return true; }
					if (this._meta.isSymbolicLink) {
						return (this._targetPath && this._targetPath.supports(what));
					} else {
						return false;
					}
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
				remote$2.shell.openItem(this._path);
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
				case "r": return fs$1.createReadStream(this._path, opts); break;
				case "w": return fs$1.createWriteStream(this._path, opts); break;
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

			if (path instanceof Local && path.isSymbolicLink()) {
				return this._analyzeFile(path);
			} else if (path.supports(CHILDREN)) { // descend, recurse
				return this._analyzeDirectory(path);
			} else { // compute
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
			let result = await this._startDeleting(root);
			this._end();
			return result;
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

	const storage = Object.create(null);

	function publish(message, publisher, data) {
		let subscribers = storage[message] || [];
		subscribers.forEach(subscriber => {
			typeof(subscriber) == "function"
				? subscriber(message, publisher, data)
				: subscriber.handleMessage(message, publisher, data);
		});
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
	const INPUTS = new Set(["input", "textarea"]);

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

	function register(func, key) {
		let item = parse(key);
		item.func = func;
		REGISTRY.push(item);
	}

	window.addEventListener("keydown", handler);

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

	class Group extends Path {
		constructor(paths) {
			super();
			this._paths = paths;
		}

		getName() { return ""; } /* appending this group's name = noop; useful for recursive operations */

		async getChildren() { return this._paths; }

		supports(what) {
			switch (what) {
				case CHILDREN:
					return true;
				break;

				default:
					return this._paths.every(item => item.supports(what));
				break;
			}
		}

		toString() { return `${this._paths.length} items`; }

		async rename(newPath) {
			for (let path of this._paths) {
				let child = newPath.append(path.getName());
				await path.rename(child);
			}
		}
	}

	const remote$3 = require("electron").remote;
	const ALL = [Favorites, Local];

	function fromString(str) {
		let ctors = ALL.filter(ctor => ctor.match(str));
		if (!ctors.length) { throw new Error(`No Path available to handle "${str}"`); }
		let Ctor = ctors.shift();
		return new Ctor(str);
	}

	function group(paths) {
		return new Group(paths);
	}

	const path$1 = require("path");
	const { createTree, assert, assertTree } = require("./test-utils.js");

	exports.testDeleteFile = async function testDeleteFile(tmp) {
		const root = path$1.join(tmp, "a");
		const contents = "test file";

		createTree(root, contents);
		assertTree(root, contents);

		let o = new Delete(fromString(root));
		let result = await o.run();

		assert(result);
		assertTree(root, null);
	};

	exports.testDeleteDirectory = async function testDeleteDirectory(tmp) {
		const root = path$1.join(tmp, "a");
		const contents = {"b": { "c": "d"}, "c": "d", "e": {}};
		createTree(root, contents);
		assertTree(root, contents);

		let o = new Delete(fromString(root));
		let result = await o.run();

		assert(result);
		assertTree(root, null);
	};

	exports.testDeleteGroup = async function testDeleteGroup(tmp) {
		const dir1 = path$1.join(tmp, "a");
		const dir2 = path$1.join(tmp, "b");
		const file1 = path$1.join(tmp, "c");
		const file2 = path$1.join(tmp, "d");

		createTree(dir1, {});
		createTree(dir2, {});
		createTree(file1, "aaa");
		createTree(file2, "aaa");

		let g = group([
			fromString(dir1),
			fromString(file1)
		]);

		let o = new Delete(g);
		let result = await o.run();

		assert(result);
		assertTree(dir1, null);
		assertTree(file1, null);
		assertTree(dir2, {});
		assertTree(file2, "aaa");
	};

	exports.testDeleteSymlinkDirectory = async function testDeleteSymlinkDirectory(tmp) {
		const dir1 = path$1.join(tmp, "a");
		const contents = {"b": "aaa"};
		createTree(dir1, contents);
		assertTree(dir1, contents);

		const dir2 = path$1.join(tmp, "b");
		const path2 = fromString(dir2);
		await path2.create({link:dir1});

		let o = new Delete(fromString(dir2));
		let result = await o.run();

		assert(result);
		assertTree(dir1, contents);
	};

}());
