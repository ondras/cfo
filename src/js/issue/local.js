/* Issue window - local (ui) part */

import * as html from "util/html.js";
import * as command from "util/command.js";

const electron = require("electron");

electron.ipcRenderer.on("config", (e, data) => {
	let text = document.querySelector("#text");
	html.clear(text);
	text.appendChild(html.text(data.text));

	Array.from(document.querySelectorAll("button")).forEach(b => {
		if (data.buttons.includes(b.dataset.action)) { return; }
		b.parentNode.removeChild(b);
	});

	document.querySelector("button").focus();
});

command.register("window:close", "Escape", () => window.close());

document.addEventListener("click", e => {
	let action = e.target.dataset.action;
	if (!action) { return; }
	electron.ipcRenderer.send("action", action);
});
