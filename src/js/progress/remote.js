/* Progress window - remote (data) part */

import * as wm from "util/windowmanager.js";
import * as conf from "conf.js";

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
	backgroundColor: conf.background,
	webPreferences: { nodeIntegration: true }
}

export default class Progress {
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
			wm.removeProgress(this._window);
			this._window = null;
			this.onClose();
		});

		wm.addProgress(this._window);
	}

	close() {
		let w = this._window;
		if (!w) { return; }
		wm.removeProgress(w);
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
