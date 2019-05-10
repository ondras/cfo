/* Text viewer window - remote (data) part */

import * as conf from "conf.js";

const remote = require("electron").remote;

const windowOptions = {
	center: true,
	backgroundColor: conf.background,
	webPreferences: { nodeIntegration: true }
}

/* views everything */
export function match(path) {
	return true;	
}

export function view(path, list) {
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
