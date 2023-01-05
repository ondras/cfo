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
	const remote = require("electron").remote;

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
				remote.shell.openItem(this._path);
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

	/* Progress window - remote (data) part */

	const remote$1 = require("electron").remote;

	/* Issue window - remote (data) part */

	const remote$2 = require("electron").remote;

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

	const remote$3 = require("electron").remote;
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
	let size$1 = null;
	let position = null;

	let currentIndex = -1;
	let allImages = [];

	function syncSize() {
		if (!image.complete) { return; }
		let box = image.parentNode;
		let avail = [box.offsetWidth, box.offsetHeight];
		size$1 = [image.naturalWidth, image.naturalHeight];

		if (scale === null) { /* auto size */
			let rx = size$1[0]/avail[0];
			let ry = size$1[1]/avail[1];
			let r = Math.max(rx, ry);
			if (r > 1) {
				size$1[0] /= r;
				size$1[1] /= r;
			}
		} else {
			let coef = SCALES[scale];
			size$1[0] *= coef;
			size$1[1] *= coef;
		}

		position = [
			(avail[0]-size$1[0])/2,
			(avail[1]-size$1[1])/2
		];

		image.style.width = `${Math.round(size$1[0])}px`;
		image.style.height = `${Math.round(size$1[1])}px`;
		image.style.left = `${Math.round(position[0])}px`;
		image.style.top = `${Math.round(position[1])}px`;

		let percent = Math.round(100*(size$1[0]/image.naturalWidth));
		let win = electron.remote.getCurrentWindow();
		let path = allImages[currentIndex];
		win.setTitle(`(${percent}%) ${path}`);

		document.querySelector(".scale").textContent = `${percent}%`;
	}

	function findScale(diff) {
		let frac = size$1[0]/image.naturalWidth;
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
			pos = Math.max(pos, avail[i]-size$1[i]);
			position[i] = pos;
			image.style[prop] = `${Math.round(pos)}px`;
		});
	}

	function onMouseMove(e) {
		if (!image.complete) { return; }
		let frac = image.naturalWidth / size$1[0];
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

		let parts = allImages[currentIndex].toString().split("/");
		image.src = parts.map(encodeURIComponent).join("/");
	}

	electron.ipcRenderer.on("path", (e, all, i) => {
		allImages = all.map(fromString);
		load(i);
	});

	image.addEventListener("load", onLoad);
	window.addEventListener("resize", syncSize);
	window.addEventListener("mousemove", onMouseMove);

	register$1("window:close", "Escape", () => {
		window.close();
	});
	// FIXME plus nefunguje se shift
	register$1("image:zoomin", "+", () => zoom(+1));
	register$1("image:zoomout", "-", () => zoom(-1));
	register$1("image:fit", "*", () => {
		scale = null;
		syncSize();
	});

	register$1("image:left", "ArrowLeft", () => moveBy([1, 0]));
	register$1("image:right", "ArrowRight", () => moveBy([-1, 0]));
	register$1("image:up", "ArrowUp", () => moveBy([0, 1]));
	register$1("image:down", "ArrowDown", () => moveBy([0, -1]));

	register$1("image:full", "Enter", () => {
		let win = electron.remote.getCurrentWindow();
		win.setFullScreen(!win.isFullScreen());
		syncSize();
	});

	register$1("image:next", ["PageDown", " "], () => loadAnother(+1));
	register$1("image:prev", ["PageUp", "Backspace"], () => loadAnother(-1));
	register$1("image:prev", "Home", () => loadAnother(-Infinity));
	register$1("image:prev", "End", () => loadAnother(+Infinity));

}());
