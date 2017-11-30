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

class Progress {
	constructor(config) {
		this._config = config;
		this._data = {};
		this._window = null;
		this._timeout = null;
	}

	open() {
		let options = Object.assign({}, windowOptions, {title: this._config.title});
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

class Issue {
	constructor(config) {
		this._config = config;
		this._window = null;
		this._resolve = null;
	}

	open() {
		let options = Object.assign({}, windowOptions$1, {title: this._config.title});
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
 // create descendants
 // can we read contents?
 // can we rename / modify contents?

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

console.log(Delete);

}());
