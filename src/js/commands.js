import prompt from "ui/prompt.js";
import confirm from "ui/confirm.js";

import { CREATE, EDIT, RENAME, DELETE } from "path/path.js";
import * as panes from "panes.js";
import * as command from "util/command.js";
import LocalPath from "path/local.js";
import Delete from "operation/delete.js";

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
	let home = LocalPath.home();
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

command.register("file:delete", "Delete", () => {
	let path = panes.getActive().getList().getFocusedPath();
	if (!path.supports(DELETE)) { return; }

	confirm(`Really delete "${path.getPath()}" ?`).then(result => {
		if (!result) { return; }
		new Delete(path).run(); // fixme then
	});
});

command.register("file:rename", "F2", () => {
	let list = panes.getActive().getList();
	let file = list.getFocusedPath();
	if (!file.supports(RENAME)) { return; }
	list.startEditing();
});

command.register("app:devtools", "F12", () => {
	require("electron").remote.getCurrentWindow().toggleDevTools();
});
