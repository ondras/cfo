/* Image viewer window - remote (data) part */

import * as conf from "conf.js";
import { VIEW } from "path/path.js";

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

export async function view(path, list) {
	let [width, height] = remote.getCurrentWindow().getSize();
	let currentOptions = { title: path.toString(), width, height };
	let options = Object.assign({}, windowOptions, currentOptions);

	let window = new remote.BrowserWindow(options);
	window.setMenu(null);
	window.loadURL(`file://${__dirname}/../viewer/image/index.html`);

	let paths = await list.getPath().getChildren();
	paths = paths.filter(path => path.supports(VIEW))
				.filter(match)
				.map(path => path.toString());
	let index = paths.indexOf(path.toString());
	if (index == -1) { throw new Error(`Path ${path} not found in its list`); }

	let webContents = window.webContents;
	webContents.once("did-finish-load", () => {
		webContents.send("path", paths, index);
	});
}
