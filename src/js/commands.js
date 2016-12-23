import prompt from "util/prompt.js";
import { CREATE, EDIT } from "path/path.js";
import * as panes from "panes.js";
import * as command from "util/command.js";
import LocalPath from "path/local.js";

const {app} = require("electron").remote;

command.register("list:up", "Backspace", () => {
	let list = panes.getActive().getList();
	let parent = list.getPath().getParent();
	parent && list.setPath(parent);
});

command.register("list:top", "Ctrl+Backspace", () => {
	let list = panes.getActive().getList();
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
	panes.getActive().getList().setPath(home);
});

command.register("list:input", "Ctrl+L", () => {
	panes.getActive().getList().focusInput();
});

command.register("directory:new", "F7", () => {
	let list = panes.getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	prompt(`Create new directory in "${path.getPath()}"`).then(name => {
		if (!name) { return; }

		let newPath = path.append(name);
		newPath.create({dir:true}).then(
			() => list.reload(newPath),
			e => alert(e.message)
		);
	});
});

command.register("file:new", "Shift+F4", () => {
	let list = panes.getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	/* fixme new.txt mit jako preferenci */
	prompt(`Create new file in "${path.getPath()}"`, "new.txt").then(name => {
		if (!name) { return; }

		let newPath = path.append(name);
		newPath.create({dir:false}).then(
			() => list.reload(newPath),
			e => alert(e.message)
		);
	});
});

command.register("file:edit", "F4", () => {
	let file = panes.getActive().getList().getFocusedPath();
	if (!file.supports(EDIT)) { return; }

	/* fixme configurable */
	let child = require("child_process").spawn("/usr/bin/sublx", [file.getPath()]);

	child.on("error", e => alert(e.message));
});	
