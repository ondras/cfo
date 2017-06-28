/* Issue window - remote (data) part */

import * as wm from "util/windowmanager.js";

const remote = require("electron").remote;
const windowOptions = {
	parent: remote.getCurrentWindow(),
	resizable: false,
	fullscreenable: false,
	alwaysOnTop: true,
	center: true,
	width: 500,
	height: 60,
	show: false,
	useContentSize: true
}

export default class Issue {
	constructor(config) {
		this._config = config;
		this._window = null;
		this._resolve = null;
	}

	open() {
		let options = Object.assign({}, windowOptions, {title: this._config.title});
		this._window = new remote.BrowserWindow(options);
		this._window.loadURL(`file://${__dirname}/issue.html`);

		let webContents = this._window.webContents;
		webContents.once("did-finish-load", () => {
			// fixme can throw when called after the window is closed
			webContents.send("config", this._config);
		});

		remote.ipcMain.once("action", (e, action) => {
			let w = this._window;
			wm.removeIssue(w);
			this._window = null;
			w.close();
			this._resolve(action);
		});

		this._window.on("closed", () => {
			if (!this._window) { return; } // closed programatically, ignore
			wm.removeIssue(this._window);
			this._window = null;
			this._resolve("abort");
		});

		wm.addIssue(this._window);
		return new Promise(resolve => this._resolve = resolve);
	}
}
