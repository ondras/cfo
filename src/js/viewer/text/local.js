/* Text viewer window - local (ui) part */

import * as html from "util/html.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";

const electron = require("electron");
let buffer = Buffer.from([]);

electron.ipcRenderer.on("path", (e, data) => {
	let path = paths.fromString(data);
	let stream = path.createStream("r");

	stream.on("data", part => {
		buffer = Buffer.concat([buffer, part]);
		document.querySelector("textarea").value = buffer;
	});
});

command.register("window:close", "Escape", () => {
	window.close();
});
