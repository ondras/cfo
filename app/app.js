(function () {
	'use strict';

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
		close(input.value);
	});

	cancel.addEventListener("click", e => {
		close(false);
	});

	function onKeyDown(e) {
		if (e.key == "Escape") { close(null); }
		e.stopPropagation();
	}

	function close(value) {
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
		close$1(true);
	});

	cancel$1.addEventListener("click", e => {
		close$1(false);
	});

	function onKeyDown$1(e) {
		if (e.key == "Escape") { close$1(false); }
		e.stopPropagation();
	}

	function close$1(value) {
		window.removeEventListener("keydown", onKeyDown$1, true);
		body$1.classList.remove("modal");
		form$1.parentNode.removeChild(form$1);
		resolve$1(value);
	}

	function confirm$1(t) {
		clear(text$2);
		text$2.appendChild(text(t));

		body$1.classList.add("modal");
		body$1.appendChild(form$1);
		window.addEventListener("keydown", onKeyDown$1, true);
		ok$1.focus();

		return new Promise(r => resolve$1 = r);
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

	const background = "#e8e8e8";

	/* Text viewer window - remote (data) part */

	const remote = require("electron").remote;

	const windowOptions = {
		center: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
	};

	/* views everything */
	function match(path) {
		return true;	
	}

	function view(path, list) {
		let [width, height] = remote.getCurrentWindow().getSize();
		let currentOptions = { title: path.toString(), width, height };
		let options = Object.assign({}, windowOptions, currentOptions);

		let window = new remote.BrowserWindow(options);
		window.setMenu(null);
		window.loadURL(`file://${__dirname}/../viewer/text/index.html`);

		let webContents = window.webContents;
		webContents.once("did-finish-load", () => {
			webContents.send("path", path.toString());
		});
	}

	var text$3 = /*#__PURE__*/Object.freeze({
		match: match,
		view: view
	});

	/* Image viewer window - remote (data) part */

	const remote$1 = require("electron").remote;

	const windowOptions$1 = {
		center: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
	};

	function match$1(path) {
		let ext = path.toString().split(".").pop();
		if (!ext) { return; }
		return ext.match(/jpe?g|gif|png|svg|bmp|ico/i);
	}

	async function view$1(path, list) {
		let [width, height] = remote$1.getCurrentWindow().getSize();
		let currentOptions = { title: path.toString(), width, height };
		let options = Object.assign({}, windowOptions$1, currentOptions);

		let window = new remote$1.BrowserWindow(options);
		window.setMenu(null);
		window.loadURL(`file://${__dirname}/../viewer/image/index.html`);

		let paths = await list.getPath().getChildren();
		paths = paths.filter(path => path.supports(READ) && !path.supports(CHILDREN))
					.filter(match$1)
					.map(path => path.toString());
		let index = paths.indexOf(path.toString());
		if (index == -1) { throw new Error(`Path ${path} not found in its list`); }

		let webContents = window.webContents;
		webContents.once("did-finish-load", () => {
			webContents.send("path", paths, index);
		});
	}

	var image = /*#__PURE__*/Object.freeze({
		match: match$1,
		view: view$1
	});

	/* Audio/Video viewer window - remote (data) part */

	const remote$2 = require("electron").remote;
	const audio = /(ogg|mp3|wav|m4a)$/i;
	const video = /(mpe?g|mkv|webm|mov|mp4)$/i;

	const windowOptions$2 = {
		center: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
	};

	function match$2(path) {
		let ext = path.toString().split(".").pop();
		return ext.match(audio) || ext.match(video);
	}

	function view$2(path, list) {
		let [width, height] = remote$2.getCurrentWindow().getSize();
		let currentOptions = { title: path.toString(), width, height };
		let options = Object.assign({}, windowOptions$2, currentOptions);

		let window = new remote$2.BrowserWindow(options);
		window.setMenu(null);
		window.loadURL(`file://${__dirname}/../viewer/av/index.html`);

		let webContents = window.webContents;
		webContents.once("did-finish-load", () => {
			let ext = path.toString().split(".").pop();
			let nodeName = (ext.match(audio) ? "audio" : "video");
			webContents.send("path", path.toString(), nodeName);
		});
	}

	var av = /*#__PURE__*/Object.freeze({
		match: match$2,
		view: view$2
	});

	const viewers = [image, av, text$3];

	function view$3(path, list) {
		for (let viewer of viewers) {
			if (viewer.match(path)) { return viewer.view(path, list); }
		}
	}

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

	const remote$3 = require("electron").remote;
	const TIMEOUT = 1000/30; // throttle updates to once per TIMEOUT

	const windowOptions$3 = {
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
			let options = Object.assign({}, windowOptions$3, {title: this._config.title});
			options.parent = remote$3.getCurrentWindow();
			this._window = new remote$3.BrowserWindow(options);
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

	const remote$4 = require("electron").remote;
	const windowOptions$4 = {
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
			let options = Object.assign({}, windowOptions$4, {title: this._config.title});
			options.parent = remote$4.getCurrentWindow();
			this._window = new remote$4.BrowserWindow(options);
			this._window.setMenu(null);
			this._window.loadURL(`file://${__dirname}/../issue/index.html`);

			let webContents = this._window.webContents;
			webContents.once("did-finish-load", () => {
				// fixme can throw when called after the window is closed
				webContents.send("config", this._config);
			});

			remote$4.ipcMain.once("action", (e, action) => {
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

	const promisify = require("util").promisify;
	const fs = require("fs");

	const readlink = promisify(fs.readlink);
	const readdir = promisify(fs.readdir);
	const mkdir = promisify(fs.mkdir);
	const rmdir = promisify(fs.rmdir);
	const open = promisify(fs.open);
	const close$2 = promisify(fs.close);
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

	function set(key, value) {
		return settings.set(key, value);
	}

	const MASK = "rwxrwxrwx";
	const autoSize = get("autosize");
	const UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
	const UNIT_STEP = 1 << 10;

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
	const remote$5 = require("electron").remote;

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
				remote$5.shell.openItem(this._path);
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
				return close$2(handle);
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

	class QuickEdit {
		constructor() {
			this._resolve = null;
			this._oldValue = "";

			this._input = node("input", {type:"text"});
			this._input.addEventListener("keydown", this);
		}

		start(value, cell) {
			this._oldValue = value; /* remember so we can put it back on escape */

			let image = cell.querySelector("img, canvas");
			let width = cell.offsetWidth - image.offsetWidth;
			while (image.nextSibling) {
				image.nextSibling.parentNode.removeChild(image.nextSibling);
			}

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

		getImage() { return create("up"); }
		getName() { return ".."; }
		getDescription() { return this._path.getDescription(); }
		toString() { return this._path.toString(); }
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

	function unsubscribe(message, subscriber) {
		let index = (storage[message] || []).indexOf(subscriber);
		if (index > -1) { storage[message].splice(index, 1); }
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

	let storage$1 = []; // strings
	let root = null; // root fav: path

	function viewFunc(i) {
		return async () => {
			let path = get$1(i);
			if (!path) { return; }
			getActive().getList().setPath(path);
		};
	}

	function setFunc(i) {
		return async () => {
			let path = getActive().getList().getPath();
			let result = await confirm$1(`Set "${path}" as favorite? It will be accessible as Ctrl+${i}.`);
			if (!result) { return; }
			set$1(path, i);
		}
	}

	function init(saved) {
		root = fromString("fav:");

		for (let i=0; i<10; i++) {
			let str = saved[i];
			storage$1[i] = str ? fromString(str) : null;

			register(viewFunc(i), `Ctrl+Digit${i}`);
			register(setFunc(i), `Ctrl+Shift+Digit${i}`);
		}
	}

	function toJSON() { return storage$1.map(path => path && path.toString()); }
	function list() { return storage$1; }
	function set$1(path, index) {
		storage$1[index] = path;
		publish("path-change", null, {path:root});
	}
	function get$1(index) { return storage$1[index]; }
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

	const remote$6 = require("electron").remote;
	const ALL = [Favorites, Local];
	const CLIP_PREFIX = "file://";

	function fromString(str) {
		let ctors = ALL.filter(ctor => ctor.match(str));
		if (!ctors.length) { throw new Error(`No Path available to handle "${str}"`); }
		let Ctor = ctors.shift();
		return new Ctor(str);
	}

	function toClipboard(path) {
		return `${CLIP_PREFIX}${path}`;
	}

	function fromClipboard(name) {
		if (name.indexOf(CLIP_PREFIX) == 0) {
			return fromString(name.substring(CLIP_PREFIX.length));
		} else {
			return null;
		}
	}

	function home() {
		return fromString(remote$6.app.getPath("home"));
	}

	function favorites() {
		return new Favorites();
	}

	function group(paths) {
		return new Group(paths);
	}

	function isGroup(path) {
		return path instanceof Group;
	}

	const node$1 = document.querySelector("footer");

	function set$2(value) {
		node$1.innerHTML = value;
	}

	const TEMPLATE = document.querySelector("#list");

	function SORT(a, b) {
		let childScoreA = a.getSort();
		let childScoreB = b.getSort();
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
			this._selected = new Set();

			subscribe("path-change", this);
		}

		destroy() {
			unsubscribe("path-change", this);
		}

		getNode() { return this._node; }
		getPath() { return this._path; }

		clearSelection() {
			this._selected.clear();
			this._syncSelected();
		}

		reload(pathToBeFocused) {
			this._pathToBeFocused = pathToBeFocused;
			this._loadPathContents(this._path);
		}

		async setPath(path) {
			this._pathToBeFocused = this._path; // will try to focus it afterwards
			await path.stat();
			let loaded = await this._loadPathContents(path);
			if (loaded) {
				publish("list-change", this);
				this._updateTitle();
			}
			return loaded;
		}

		focusInput() {
			this._input.focus();
			this._input.selectionStart = 0;
			this._input.selectionEnd = this._input.value.length;
		}

		getSelection(options = {}) {
			if (!options.multi || this._selected.size == 0) {
				let index = this._getFocusedIndex();
				if (index == -1) { return null; }
				return this._items[index].path;
			} else {
				let items = [];
				this._selected.forEach(index => items.push(this._items[index].path));
				return group(items);
			}
		}

		activate() {
			if (this._active) { return; }

			this._node.classList.add("active");
			this._active = true;
			document.addEventListener("keydown", this);

			this._focusPath(this._pathToBeFocused, 0);
			this._pathToBeFocused = null;

			this._updateTitle();
		}

		deactivate() {
			if (!this._active) { return; }

			this._active = false;
			document.removeEventListener("keydown", this);
			this._node.classList.remove("active");

			this._quickEdit.stop();
			this._prefix = "";

			this._pathToBeFocused = this.getSelection({multi:false});
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

			await newPath.stat();
			if (newPath.exists()) {
				let result = await confirm(`Target path "${path}" already exists. Overwrite?`);
				if (!result) { return; }
			}

			try {
				await path.rename(newPath);
				this.reload(newPath);
			} catch (e) {
				alert(e.message);
			}
		}

		handleMessage(message, publisher, data) {
			switch (message) {
				case "path-change":
					if (data.path.is(this._path)) { this.reload(); }
				break;
			}
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
						return;
					}

					if (e.ctrlKey) { // ctrl+a = vyber vseho
						if (e.key == "a") { 
							e.preventDefault();
							this._selectAll();
						}
					} else { // nechceme aby ctrl+l hledalo od "l"
						e.preventDefault();
						this._handleKey(e.key);
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
			let item;

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

				case "Insert":
					if (index == -1) { return; }
					this._selectToggle(index);
					this._focusBy(+1);
				break;

				case " ":
					if (index == -1) { return; }
					this._selectToggle(index);

					item = this._items[index];
					let scan = new Scan(item.path);
					let result = await scan.run();
					if (!result) { return; }
					item.size = result.size;

					clear(item.node);
					this._buildRow(item);

					this._prefix = "";
					this._focusBy(+1);
				break;

				case "Escape":
					this._prefix = "";
					if (index > -1) { this._focusAt(index); } /* redraw without prefix highlight */
				break;

				case "+": this._addSelected(); break;
				case "-": this._removeSelected(); break;
				case "*": this._invertSelected(); break;

				default:
					if (key.length == 1) { this._search(key.toLowerCase()); }
				break;
			}
		}

		async _loadPathContents(path) {
			try {
				let paths = await path.getChildren();
				this._path = path;
				this._show(paths);
				return true;
			} catch (e) {
				// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
				alert(e.message);
				return false;
			}
		}

		_activatePath() {
			let path = this.getSelection({multi:false});
			if (!path) { return; }
			path.activate(this);
		}

		_show(paths) {
			let fallbackIndex = (this._pathToBeFocused ? 0 : this._getFocusedIndex());

			this._clear();
			this._selected.clear();

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
			let img = path.getImage();
			td.appendChild(img);

			let name = path.getName();
			if (name) { td.appendChild(text(name)); }

			let size$$1 = path.getSize();
			if (size$$1 === undefined) { size$$1 = item.size; } /* computed value (for directories) */
			node$$1.insertCell().innerHTML = (size$$1 === undefined ? "" : size(size$$1, {auto:true}));

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
			return this._items.reduce((result, item, index) => (item.node == focused ? index : result), -1);
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
						let image = cell.querySelector("img, canvas");
						clear(cell);
						cell.appendChild(image);

						let strong = node("strong", {}, name.substring(0, plen));
						cell.appendChild(strong);
						cell.appendChild(text(name.substring(plen)));
					}
				}

				this._updateStatus();
			}
		}

		/* Focus a given path. If not available, focus a given index. */
		_focusPath(path, fallbackIndex) {
			let focusIndex = this._items.reduce((result, item, index) => {
				return (path && item.path.is(path) ? index : result);
			}, fallbackIndex);
			this._focusAt(focusIndex);
		}

		_updateStatus() {
			let index = this._getFocusedIndex();
			let str = this._items[index].path.getDescription();

			let selected = Object.keys(this._selected);
			if (this._selected.size > 0) {
				let fileCount = 0;
				let dirCount = 0;
				let bytes = 0;
				this._selected.forEach(index => {				let item = this._items[index];

					if (item.path.supports(CHILDREN)) {
						dirCount++;
					} else {
						fileCount++;
					}
					
					if ("size" in item) {
						bytes += item.size;
					} else {
						bytes += item.path.getSize() || 0;
					}
				});
				
				str = `Selected ${size(bytes, {auto:false})} bytes in ${fileCount} files and ${dirCount} directories`;
			}

			set$2(str);
		}

		_updateTitle() {
			let path = this._path;
			if (!path) { return; }
			document.title = `${path.toString()} – CFO`;
		}


		_search(ch) {
			let str = `${this._prefix}${ch}`;

			let startIndex = this._getFocusedIndex();
			if (startIndex == -1) { startIndex = 0; }

			// start at the currently focused index
			let items = this._items.slice(startIndex);
			if (startIndex > 0) { items = items.concat(this._items.slice(0, startIndex)); }

			for (let i=0; i<items.length; i++) {
				let name = items[i].path.getName();
				if (!name) { continue; }
				if (name.toLowerCase().indexOf(str) == 0) { /* found! */
					this._prefix = str;
					this._focusAt((i + startIndex) % items.length);
					return;
				}
			}
			/* not found, nothing */
		}

		_syncSelected() {
			this._items.forEach((item, index) => {
				item.node.classList.toggle("selected", this._selected.has(index));
			});
			this._updateStatus();
		}

		_clear() {
			this._items = [];
			this._table.innerHTML = "";
			this._prefix = "";
		}

		_invertSelected() {
			let newSelected = new Set();

			this._selected.forEach(index => { // copy already selected directories
				if (this._items[index].path.supports(CHILDREN)) { newSelected[index] = true; }
			});

			this._items.forEach((item, index) => {
				if (this._selected.has(index)) { return; } // already selected
				if (item.path.supports(CHILDREN)) { return; } // do not select directories
				if (item.path instanceof Up) { return; } // do not select "..""
				newSelected.add(index);
			});

			this._selected = newSelected;
			this._syncSelected();
		}

		async _addSelected() {
			let pattern = await this._getPattern("Select all files matching this pattern:");
			if (!pattern) { return; }
			
			this._items.forEach((item, index) => {
				if (this._selected.has(index)) { return; } // already selected
				if (item.path.supports(CHILDREN)) { return; } // do not select directories
				if (item.path.getName().match(pattern)) { this._selected.add(index); } // name match
			});

			this._syncSelected();
		}

		async _removeSelected() {
			let pattern = await this._getPattern("Deselect all files matching this pattern:");
			if (!pattern) { return; }

			this._selected.forEach(index => {
				let path = this._items[index].path;
				if (path.getName().match(pattern)) { this._selected.delete(index); } // name match
			});

			this._syncSelected();
		}

		async _getPattern(text$$1) {
			let result = await prompt(text$$1, "*");
			if (!result) { return; }

			result = result.replace(/\./g, "\\.");
			result = result.replace(/\*/g, ".*");
			result = result.replace(/\?/g, ".");

			return new RegExp(`^${result}$`);
		}

		_selectAll() {
			this._selected.clear();
			this._items.forEach((item, index) => {
				if (item.path instanceof Up) { return; }
				this._selected.add(index);
			});
			this._syncSelected();
		}

		_selectToggle(index) {
			if (this._items[index].path instanceof Up) { return; }
			if (this._selected.has(index)) {
				this._selected.delete(index);
			} else {
				this._selected.add(index);
			}
			this._syncSelected();
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

	function parsePaths(saved) {
		return saved ? saved.map(fromString) : [home()];
	}

	class Pane {
		constructor(saved = {}) {
			this._active = false;
			this._lists = [];
			this._tabs = new Tabs();
			this._labels = [];
			this._node = node("div", {className:"pane"});

			this._node.addEventListener("click", this, true); // capture phase: before the list's table processes the event

			this._node.appendChild(this._tabs.getList());
			this._node.appendChild(this._tabs.getNode());

			subscribe("tab-change", this);
			subscribe("list-change", this);

			let paths = parsePaths(saved.paths);
			paths.forEach(path => this.addList(path));
			this._tabs.selectedIndex = saved.index || 0;
		}

		getNode() { return this._node; }

		toJSON() {
			return {
				index: this._tabs.selectedIndex,
				paths: this._lists.map(l => l.getPath().toString())
			}
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

		async addList(path) {
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

			let loaded = await list.setPath(path);
			if (!loaded) { list.setPath(home()); }
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

	function getInactive() {
		return PANES[(index+1) % 2];
	}

	function init$1(saved) {
		PANES.push(new Pane(saved.left || {}));
		PANES.push(new Pane(saved.right || {}));

		let parent = document.querySelector("#panes");
		PANES.forEach(pane => parent.appendChild(pane.getNode()));

		let index = saved.index || 0;
		activate(PANES[index]);
	}

	function toJSON$1() {
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

	const clipboard = require("electron").clipboard;
	const SEP = "\n";

	function set$3(names) {
		clipboard.writeText(names.join(SEP));
	}

	function get$2() {
		return clipboard.readText().split(SEP);
	}

	const remote$7 = require("electron").remote;
	let window$1;

	const windowOptions$5 = {
		center: true,
		backgroundColor: background,
		webPreferences: { nodeIntegration: true }
	};

	function open$1() {
		if (window$1) { 
			window$1.focus();
			return;
		}

	//	let [width, height] = remote.getCurrentWindow().getSize();
	//	let currentOptions = { title: path.toString(), width, height };
		let options = Object.assign({}, windowOptions$5 /*, currentOptions */);

		window$1 = new remote$7.BrowserWindow(options);
		window$1.setMenu(null);
		window$1.loadURL(`file://${__dirname}/../settings/index.html`);

		window$1.on("closed", () => window$1 = null);
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

	// copy to the same parent -- create a " copy" suffix
	async function createCopyOf(path) {
		let num = 0;
		let parent = path.getParent();
		let name = path.getName();

		while (true) {
			num++;
			let suffix = ` (copy${num > 1 ? " "+num : ""})`;

			let parts = name.split(".");
			let index = (parts.length > 1 ? parts.length-2 : parts.length-1);
			parts[index] += suffix;
			let newName = parts.join(".");

			let newPath = parent.append(newName);
			await newPath.stat();
			if (!newPath.exists()) { return newPath; }
		}}

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

			let result = await this._copy(root, this._targetPath);

			this._end();
			return result;
		}

		/**
		 * @param {object} record Source record
		 * @param {Path} targetPath Target path
		 */
		async _copy(record, targetPath) {
			if (this._aborted) { return false; }

			await targetPath.stat();
			if (targetPath.exists()) { targetPath = await this._resolveExistingTarget(targetPath, record); }

			// does not exist => will be created during copy impl below

			if (record.children !== null) {
				return this._copyDirectory(record, targetPath);
			} else {
				return this._copyFile(record, targetPath);
			}
		}

		/**
		 * Copy a directory record to target directory path
		 * @param {object} record
		 * @param {Path} targetPath already appended target path
		 */
		async _copyDirectory(record, targetPath) {
			let created = await this._createDirectory(targetPath, record.path.getMode());
			if (!created) { return false; }

			let okay = true;
			for (let child of record.children) {
				let childOkay = await this._copy(child, targetPath);
				if (!childOkay) { okay = false; }
			}

			let date = record.path.getDate();
			if (date) { await targetPath.setDate(date); }

			return okay;
		}

		/**
		 * @returns {Promise<bool>}
		 */
		async _createDirectory(path, mode) {
			if (path.exists() && path.supports(CHILDREN)) { return true; } // directory already exists, fine

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

			if (targetPath.exists()) { // target exists: overwrite/skip/abort
				let canOverwrite = await this._canOverwrite(record, targetPath);
				if (!canOverwrite)  { return false; }
			}

			if (record.path instanceof Local && record.path.isSymbolicLink()) {
				return this._copyFileSymlink(record, targetPath);
				// no setDate here, fs.utimes adjusts target's mtime instead
			} else {
				let contentsOkay = await this._copyFileContents(record, targetPath);
				let date = record.path.getDate();
				await targetPath.setDate(date);
				return contentsOkay;
			}
		}

		async _copyFileSymlink(record, targetPath) {
			try {
				await targetPath.create({link:record.path.getTarget()});
				return true;
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

			return new Promise((resolve, reject) => {
				let handleError = async e => {
					try {
						let result = await this._handleCopyError(e, record, targetPath);
						resolve(result);
					} catch (e) {
						reject(e);
					}
				};
				readStream.on("error", handleError);
				writeStream.on("error", handleError);

				writeStream.on("finish", () => resolve(true));

				readStream.on("data", buffer => {
					done += buffer.length;
					this._stats.done += buffer.length;

					let progress1 = 100*done/record.size; 
					let progress2 = 100*this._stats.done/this._stats.total;
					this._progress.update({progress1, progress2});
				}); /* on data */
			}); /* file copy promise */		
		}

		async _canOverwrite(record, targetPath) {
			if (this._issues.overwrite == "overwrite-all") { return true; }

			if (this._issues.overwrite == "skip-all") { // silently skip
				this._stats.done += record.size;
				return false;
			}

			// no "-all" resolution
			let result = await this._handleFileExists(targetPath);
			switch (result) {
				case "abort":
					this.abort();
					return false;
				break;
				case "skip":
				case "skip-all":
					this._stats.done += record.size;
					return false;
				break;
				default: return true; break; // overwrite/overwrite-all
			}
		}

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
			return false;
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
			return false;
		}

		async _resolveExistingTarget(targetPath, record) {
			// existing file
			if (!targetPath.supports(CHILDREN)) {
				if (targetPath.is(record.path)) { return createCopyOf(targetPath); }
				return targetPath;
			}

			// existing dir: needs two copyOf checks
			if (targetPath.is(record.path)) { return createCopyOf(targetPath); }
			targetPath = targetPath.append(record.path.getName());
			await targetPath.stat();
			if (targetPath.is(record.path)) { return createCopyOf(targetPath); }

			return targetPath;
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

		async _copyDirectory(record, targetPath) {
			let renamed = await this._rename(record, targetPath);
			if (renamed) { return true; }

			let copied = await super._copyDirectory(record, targetPath);
			return (copied ? this._delete(record) : false);
		}

		async _copyFile(record, targetPath) {
			if (targetPath.exists()) { // target exists: overwrite/skip/abort
				let canOverwrite = await this._canOverwrite(record, targetPath);
				if (!canOverwrite)  { return false; }
			}

			let renamed = await this._rename(record, targetPath);
			if (renamed) { return true; }

			let copied = await super._copyFile(record, targetPath);
			return (copied ? this._delete(record) : false);
		}

		async _rename(record, targetPath) {
			try {
	//			console.log("rename", record.path+"", targetPath+"");
				await record.path.rename(targetPath);
				this._stats.done += record.size;
	//			console.log("ok");
				return true;
			} catch (e) { /*console.log("rename failed");*/return false; } // quick rename failed, need to copy+delete
		}

		async _delete(record) {
			try {
				await record.path.delete();
				return true;
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
				case "retry": return this._delete(record); break;
				case "abort": this.abort(); break;
			}
		}

		async _resolveExistingTarget(targetPath, record) {
			// existing file
			if (!targetPath.supports(CHILDREN)) { return targetPath; }

			// existing dir: append leaf name
			targetPath = targetPath.append(record.path.getName());
			await targetPath.stat();
			return targetPath;
		}
	}

	let clipMode = "";

	async function copyOrCut(mode) {
		let sourceList = getActive().getList();
		let sourcePath = sourceList.getSelection({multi:true});

		let items = [];
		if (isGroup(sourcePath)) {
			items = await sourcePath.getChildren();
		} else {
			items = [sourcePath];
		}

		let names = items.map(path => toClipboard(path));
		set$3(names);
		clipMode = mode;
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

	register$1("clip:copy", "Ctrl+C", () => {
		copyOrCut("copy");
	});

	register$1("clip:cut", "Ctrl+X", () => {
		copyOrCut("cut");
	});

	register$1("clip:paste", "Ctrl+V", async () => {
		let list = getActive().getList();
		let path = list.getPath();

		/* group of valid paths */
		let p = get$2().map(fromClipboard).filter(path => path);
		if (!p.length) { return; }

		let group$$1 = group(p);

		let Ctor = (clipMode == "cut" ? Move : Copy);
		let operation = new Ctor(group$$1, path);
		await operation.run();

		publish("path-change", null, {path});
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

		let name = get("newfile");
		name = await prompt(`Create new file in "${path}"`, name);
		if (!name) { return; }

		let newPath = path.append(name);
		try {
			await newPath.create({dir:false});
			list.reload(newPath);
		} catch (e) {
			alert(e.message);
		}
	});

	register$1("file:view", "F3", () => {
		let list = getActive().getList();
		let file = list.getSelection({multi:false});
		if (file.supports(CHILDREN) || !file.supports(READ)) { return; }

		view$3(file, list);
	});

	register$1("file:edit", "F4", () => {
		let file = getActive().getList().getSelection({multi:false});
		if (!file.supports(WRITE)) { return; }

		let bin = get("editor.bin");
		let child = require("child_process").spawn(bin, [file]);

		child.on("error", e => alert(e.message));
	});

	register$1("file:delete", ["F8", "Delete", "Shift+Delete"], async () => {
		let list = getActive().getList();
		let path = list.getSelection({multi:true});
		if (!path.supports(WRITE)) { return; }

		let result = await confirm$1(`Really delete "${path}" ?`);
		if (!result) { return; }
		let d = new Delete(path);
		await d.run();

		publish("path-change", null, {path: list.getPath()});
	});

	register$1("file:rename", "F2", () => {
		let list = getActive().getList();
		let file = list.getSelection({multi:false});
		if (!file.supports(WRITE)) { return; }
		list.startEditing();
	});

	register$1("file:copy", "F5", async () => {
		let sourceList = getActive().getList();
		let sourcePath = sourceList.getSelection({multi:true});
		let targetList = getInactive().getList();
		let targetPath = targetList.getPath();

		if (!sourcePath.supports(READ)) { return; }

		/* fixme parent->child test */

		let name = await prompt(`Copy "${sourcePath}" to:`, targetPath);
		if (!name) { return; }
		targetPath = fromString(name);
		let copy = new Copy(sourcePath, targetPath);
		await copy.run();

		sourceList.clearSelection();
		publish("path-change", null, {path:targetPath});
	});

	register$1("file:move", "F6", async () => {
		let sourceList = getActive().getList();
		let sourcePath = sourceList.getSelection({multi:true});
		let targetList = getInactive().getList();
		let targetPath = targetList.getPath();

		if (!sourcePath.supports(READ)) { return; }
		if (!sourcePath.supports(WRITE)) { return; }

		/* fixme parent->child test */

		let name = await prompt(`Move "${sourcePath}" to:`, targetPath);
		if (!name) { return; }
		targetPath = fromString(name);
		let move = new Move(sourcePath, targetPath);
		await move.run();

		publish("path-change", null, {path:sourceList.getPath()});
		publish("path-change", null, {path:targetPath});
	});

	register$1("app:devtools", "F12", () => {
		require("electron").remote.getCurrentWindow().toggleDevTools();
	});

	register$1("app:settings", [], () => {
		open$1();
	});

	register$1("app:terminal", [], () => {
		let bin = get("terminal.bin");
		let path = getActive().getList().getPath();
		let args = get("terminal.args").split(" ").map(arg => arg.replace("%s", path.toString()));
		console.log(bin, args);
		let child = require("child_process").spawn(bin, args);
		child.on("error", e => alert(e.message));
	});

	const Menu = require('electron').remote.Menu;

	function init$2() {
		const template = [
			{
				label: "&File",
				submenu: [
					menuItem("file:rename", "&Quick rename"),
					menuItem("file:view", "&View"),
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
					menuItem("app:terminal", "O&pen terminal"),
					menuItem("app:settings", "&Options")
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

	const {remote: remote$8} = require("electron");

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
		let win = remote$8.getCurrentWindow();
		set("window.size", win.getSize());
		set("window.position", win.getPosition());
		set("panes", toJSON$1());
		set("favorites", toJSON());
	}

	function init$3() {
		init$2();
		init(get("favorites"));
		init$1(get("panes"));
		window.addEventListener("beforeunload", saveSettings);
	}

	init$3();

	window.selftest = () => {
		var exts = require("fs").readFileSync("FILETYPES").toString().split("\n");
		window.exts = exts;
		exts.forEach(ext => {
			let file = "test."+ext;
			let mt = getType(file);
			create(mt);
		});
	};

}());
