import prompt from "ui/prompt.js";
import confirm from "ui/confirm.js";

import { CREATE, EDIT, RENAME, DELETE, VIEW } from "path/path.js";
import * as viewers from "viewer/viewers.js";
import * as panes from "panes.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";

import Delete from "operation/delete.js";
import Copy from "operation/copy.js";
import Move from "operation/move.js";

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
	let path = paths.home();
	panes.getActive().getList().setPath(path);
});

command.register("list:favorites", [], () => {
	let path = paths.favorites();
	panes.getActive().getList().setPath(path);
});

command.register("list:input", "Ctrl+L", () => {
	panes.getActive().getList().focusInput();
});

command.register("directory:new", "F7", async () => {
	let list = panes.getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	let name = await prompt(`Create new directory in "${path}"`);
	if (!name) { return; }

	let newPath = path.append(name);
	
	try {
		await newPath.create({dir:true});
		list.reload(newPath);
	} catch (e) {
		alert(e.message);
	}
});

command.register("file:new", "Shift+F4", async () => {
	let list = panes.getActive().getList();
	let path = list.getPath();
	if (!path.supports(CREATE)) { return; }

	/* fixme new.txt mit jako preferenci */
	let name = await prompt(`Create new file in "${path}"`, "new.txt");
	if (!name) { return; }

	let newPath = path.append(name);
	try {
		await newPath.create({dir:false});
		list.reload(newPath);
	} catch (e) {
		alert(e.message);
	}
});

command.register("file:view", "F3", () => {
	let file = panes.getActive().getList().getSelection({multi:false});
	if (!file.supports(VIEW)) { return; }

	viewers.view(file);
});

command.register("file:edit", "F4", () => {
	let file = panes.getActive().getList().getSelection({multi:false});
	if (!file.supports(EDIT)) { return; }

	/* fixme configurable */
	let child = require("child_process").spawn("/usr/bin/subl", [file]);

	child.on("error", e => alert(e.message));
});

command.register("file:delete", ["F8", "Delete", "Shift+Delete"], async () => {
	let list = panes.getActive().getList();
	let path = list.getSelection({multi:true});
	if (!path.supports(DELETE)) { return; }

	let result = await confirm(`Really delete "${path}" ?`);
	if (!result) { return; }
	let d = new Delete(path);
	await d.run();
	list.reload();
});

command.register("file:rename", "F2", () => {
	let list = panes.getActive().getList();
	let file = list.getSelection({multi:false});
	if (!file.supports(RENAME)) { return; }
	list.startEditing();
});

command.register("file:copy", "F5", async () => {
	let sourceList = panes.getActive().getList();
	let sourcePath = sourceList.getSelection({multi:true});
	let targetList = panes.getInactive().getList();
	let targetPath = targetList.getPath();

	/* fixme parent->child test */

	let name = await prompt(`Copy "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = paths.fromString(name);
	let copy = new Copy(sourcePath, targetPath);
	await copy.run();
	sourceList.reload();
	targetList.reload();
});

command.register("file:move", "F6", async () => {
	let sourceList = panes.getActive().getList();
	let sourcePath = sourceList.getSelection({multi:true});
	let targetList = panes.getInactive().getList();
	let targetPath = targetList.getPath();

	/* fixme parent->child test */

	let name = await prompt(`Move "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = paths.fromString(name);
	let move = new Move(sourcePath, targetPath);
	await move.run();
	sourceList.reload();
	targetList.reload();
});

command.register("app:devtools", "F12", () => {
	require("electron").remote.getCurrentWindow().toggleDevTools();
});
