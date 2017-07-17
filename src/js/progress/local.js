/* Progress window - local (ui) part */

import * as html from "util/html.js";
import * as command from "util/command.js";

const electron = require("electron");

const DOM = {
	row1: {
		label: document.querySelector("dt.row-1"),
		value: document.querySelector("dd.row-1")
	},
	row2: {
		label: document.querySelector("dt.row-2"),
		value: document.querySelector("dd.row-2")
	},
	progress1: {
		label: document.querySelector("dt.progress-1"),
		value: document.querySelector("dd.progress-1 progress")
	},
	progress2: {
		label: document.querySelector("dt.progress-2"),
		value: document.querySelector("dd.progress-2 progress")
	}
}

electron.ipcRenderer.on("config", (e, data) => {
	if ("row1" in data) {
		DOM.row1.label.appendChild(html.text(data.row1));
	} else {
		DOM.row1.label.style.display = "none";
		DOM.row1.value.style.display = "none";
	}

	if ("row2" in data) {
		DOM.row2.label.appendChild(html.text(data.row2));
	} else {
		DOM.row2.label.style.display = "none";
		DOM.row2.value.style.display = "none";
	}

	if ("progress1" in data) {
		DOM.progress1.label.appendChild(html.text(data.progress1));
	} else {
		DOM.progress1.label.style.display = "none";
		DOM.progress1.value.style.display = "none";
	}

	if ("progress2" in data) {
		DOM.progress2.label.appendChild(html.text(data.progress2));
	} else {
		DOM.progress2.label.style.display = "none";
		DOM.progress2.value.style.display = "none";
	}
});

electron.ipcRenderer.on("data", (e, data) => {
	let node;

	if ("row1" in data) {
		node = DOM.row1.value;
		html.clear(node);
		node.appendChild(html.text(data.row1));
	}

	if ("row2" in data) {
		node = DOM.row2.value;
		html.clear(node);
		node.appendChild(html.text(data.row2));
	}

	if ("progress1" in data) {
		node = DOM.progress1.value;
		node.value = data.progress1;
	}

	if ("progress2" in data) {
		node = DOM.progress2.value;
		node.value = data.progress2;
	}
});

command.register("window:close", "Escape", () => {
	window.close();
});
