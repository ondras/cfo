import Pane from "ui/pane.js";
import * as command from "util/command.js";

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

export function getInactive() {
	return PANES[(index+1) % 2];
}

export function init(saved) {
	PANES.push(new Pane(saved.left || {}));
	PANES.push(new Pane(saved.right || {}));

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));

	let index = saved.index || 0;
	activate(PANES[index]);
}

export function toJSON() {
	return {
		index,
		left: PANES[0].toJSON(),
		right: PANES[1].toJSON()
	}
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

command.register("tab:new", "Ctrl+T", () => {
	getActive().addList();
});

command.register("tab:close", "Ctrl+W", () => {
	getActive().removeList();
});
