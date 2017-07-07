/* Text viewer window - remote (data) part */

import * as conf from "conf.js";

const remote = require("electron").remote;

const windowOptions = {
	parent: remote.getCurrentWindow(),
	resizable: true,
	fullscreenable: true,
	center: true,
	width: 640,
	height: 480,
	useContentSize: true,
	backgroundColor: conf.background
}

export function view(path) {
	let options = Object.assign({}, windowOptions, {title: path});

	let window = new remote.BrowserWindow(options);
	window.setMenu(null);
	window.loadURL(`file://${__dirname}/../viewer/text/index.html`);

	let webContents = window.webContents;
	webContents.once("did-finish-load", () => {
		webContents.send("path", path.toString());
		window.toggleDevTools();
	});
}
