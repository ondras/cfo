(function () {
'use strict';

function clear(node) {
	node.innerHTML = "";
}

function text(t) {
	return document.createTextNode(t);
}

/* Progress window - local (ui) part */

const electron = require("electron");

const row1 = document.querySelector("#row-1");
const row2 = document.querySelector("#row-2");
const progress1 = document.querySelector("#progress-1");
const progress2 = document.querySelector("#progress-2");

const DOM = {
	row1: {
		node: row1,
		label: row1.querySelector("dt"),
		value: row1.querySelector("dd")
	},
	row2: {
		node: row2,
		label: row2.querySelector("dt"),
		value: row2.querySelector("dd")
	},
	progress1: {
		node: progress1,
		label: progress1.querySelector("dt"),
		value: progress1.querySelector("progress")
	},
	progress2: {
		node: progress2,
		label: progress2.querySelector("dt"),
		value: progress2.querySelector("progress")
	}
};

electron.ipcRenderer.on("config", (e, data) => {
	if (data.row1) {
		DOM.row1.label.appendChild(text(data.row1));
	} else {
		DOM.row1.node.style.display = "none";
	}

	if (data.row2) {
		DOM.row2.label.appendChild(text(data.row2));
	} else {
		DOM.row2.node.style.display = "none";
	}

	if (data.progress1) {
		DOM.progress1.label.appendChild(text(data.progress1));
	} else {
		DOM.progress1.node.style.display = "none";
	}

	if (data.progress2) {
		DOM.progress2.label.appendChild(text(data.progress2));
	} else {
		DOM.progress2.node.style.display = "none";
	}
});

electron.ipcRenderer.on("data", (e, data) => {
	let node$$1;

	if (data.row1) {
		node$$1 = DOM.row1.value;
		clear(node$$1);
		node$$1.appendChild(text(data.row1));
	}

	if (data.row2) {
		node$$1 = DOM.row2.value;
		clear(node$$1);
		node$$1.appendChild(text(data.row2));
	}
});

}());
