import * as conf from "conf.js";

const remote = require("electron").remote;
let window;

const windowOptions = {
	center: true,
	backgroundColor: conf.background,
	webPreferences: { nodeIntegration: true }
}

export function open() {
	if (window) { 
		window.focus();
		return;
	}

//	let [width, height] = remote.getCurrentWindow().getSize();
//	let currentOptions = { title: path.toString(), width, height };
	let options = Object.assign({}, windowOptions /*, currentOptions */);

	window = new remote.BrowserWindow(options);
	window.setMenu(null);
	window.loadURL(`file://${__dirname}/../settings/index.html`);

	window.on("closed", () => window = null);
}
