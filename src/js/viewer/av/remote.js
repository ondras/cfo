/* Audio/Video viewer window - remote (data) part */

import * as conf from "conf.js";

const remote = require("electron").remote;
const audio = /(ogg|mp3|wav|m4a)$/i;
const video = /(mpe?g|mkv|webm|mov|mp4)$/i;

const windowOptions = {
	center: true,
	backgroundColor: conf.background,
	webPreferences: { nodeIntegration: true }
}

export function match(path) {
	let ext = path.toString().split(".").pop();
	return ext.match(audio) || ext.match(video);
}

export function view(path, list) {
	let [width, height] = remote.getCurrentWindow().getSize();
	let currentOptions = { title: path.toString(), width, height };
	let options = Object.assign({}, windowOptions, currentOptions);

	let window = new remote.BrowserWindow(options);
	window.setMenu(null);
	window.loadURL(`file://${__dirname}/../viewer/av/index.html`);

	let webContents = window.webContents;
	webContents.once("did-finish-load", () => {
		let ext = path.toString().split(".").pop();
		let nodeName = (ext.match(audio) ? "audio" : "video");
		webContents.send("path", path.toString(), nodeName);
	});
}
