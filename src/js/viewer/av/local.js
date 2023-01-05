/* Audio/Video viewer window - local (ui) part */

import * as command from "util/command.js";

const electron = require("electron");

electron.ipcRenderer.on("path", (e, data, nodeName) => {
	let node = document.createElement(nodeName);
	node.addEventListener("error", e => alert(e.message));

	let parts = data.split("/");
	node.src = parts.map(encodeURIComponent).join("/");
	node.controls = true;
	node.autoplay = true;
	document.body.appendChild(node);
});

command.register("window:close", "Escape", () => {
	window.close();
});
