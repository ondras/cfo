import * as command from "util/command.js";
import Pane from "pane.js";
import LocalPath from "path/local.js";

const {app} = require("electron").remote;

const PANES = [];
let index = -1;

export function activate(pane) {
	index = PANES.indexOf(pane);
	PANES[(index+1) % 2].deactivate();
	PANES[index].activate();
}

export function getActive() {
	return PANES[index];
}

export function init() {
	PANES.push(new Pane());
	PANES.push(new Pane());

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));

	activate(PANES[0]);
}

command.register("pane:toggle", "Tab", () => {
	let i = (index + 1) % PANES.length;
	activate(PANES[i]);
});

command.register("tab:next", "Ctrl+Tab", () => {
	getActive().adjustTab(+1);
});

command.register("tab:prev", "Ctrl+Shift+Tab", () => {
	getActive().adjustTab(-1);
});

command.register("list:up", "Backspace", () => {
	let list = getActive().getList();
	let parent = list.getPath().getParent();
	parent && list.setPath(parent);
});

command.register("list:top", "Ctrl+Backspace", () => {
	let list = getActive().getList();
	let path = list.getPath();
	while (true) {
		let parent = path.getParent();
		if (parent) { 
			path = parent;
		} else {
			break;
		}
	}
	list.setPath(path);
});

command.register("list:home", "Ctrl+H", () => {
	let home = new LocalPath(app.getPath("home"));
	getActive().getList().setPath(home);
});

command.register("list:input", "Ctrl+L", () => {
	getActive().getList().focusInput();
});
