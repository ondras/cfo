import * as command from "util/command.js";
import Pane from "pane.js";

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
