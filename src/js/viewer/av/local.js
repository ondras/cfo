/* Audio/Video viewer window - local (ui) part */

import * as html from "util/html.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";

const electron = require("electron");

electron.ipcRenderer.on("path", (e, data, nodeName) => {
	let node = document.createElement(nodeName);
	node.addEventListener("error", e => alert(e.message));
	node.src = data;
	node.controls = true;
	node.autoplay = true;
	document.body.appendChild(node);
});

command.register("window:close", "Escape", () => {
	window.close();
});
