/* Image viewer window - remote (data) part */

import * as conf from "conf.js";

const remote = require("electron").remote;

const windowOptions = {
	center: true,
	backgroundColor: conf.background
}

export function match(path) {
	let ext = path.toString().split(".").pop();
	if (!ext) { return; }
	return ext.match(/jpe?g|gif|png|svg|bmp|ico/i);
}

export function view(path) {
	let [width, height] = remote.getCurrentWindow().getSize();
	let currentOptions = { title: path.toString(), width, height };
	let options = Object.assign({}, windowOptions, currentOptions);

	let window = new remote.BrowserWindow(options);
	window.setMenu(null);
	window.loadURL(`file://${__dirname}/../viewer/image/index.html`);
	window.toggleDevTools();

	let webContents = window.webContents;
	webContents.once("did-finish-load", () => {
		webContents.send("path", path.toString());
	});
}
