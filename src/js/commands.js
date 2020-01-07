import prompt from "ui/prompt.js";
import confirm from "ui/confirm.js";
import { CHILDREN, CREATE, READ, WRITE  } from "path/path.js";
import * as viewers from "viewer/viewers.js";
import * as panes from "panes.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";
import * as pubsub from "util/pubsub.js";
import * as clipboard from "util/clipboard.js";
import * as settings from "util/settings.js";
import * as settingsWindow from "settings/remote.js";

import Delete from "operation/delete.js";
import Copy from "operation/copy.js";
import Move from "operation/move.js";

let clipMode = "";

async function copyOrCut(mode) {
	let sourceList = panes.getActive().getList();
	let sourcePath = sourceList.getSelection({multi:true});

	let items = [];
	if (paths.isGroup(sourcePath)) {
		items = await sourcePath.getChildren();
	} else {
		items = [sourcePath];
	}

	let names = items.map(path => paths.toClipboard(path));
	clipboard.set(names);
	clipMode = mode;
}

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

command.register("clip:copy", "Ctrl+C", () => {
	copyOrCut("copy");
});

command.register("clip:cut", "Ctrl+X", () => {
	copyOrCut("cut");
});

command.register("clip:paste", "Ctrl+V", async () => {
	let list = panes.getActive().getList();
	let path = list.getPath();

	/* group of valid paths */
	let p = clipboard.get().map(paths.fromClipboard).filter(path => path);
	if (!p.length) { return; }

	let group = paths.group(p);

	let Ctor = (clipMode == "cut" ? Move : Copy);
	let operation = new Ctor(group, path)
	await operation.run();

	pubsub.publish("path-change", null, {path});
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

	let name = settings.get("newfile");
	name = await prompt(`Create new file in "${path}"`, name);
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
	let list = panes.getActive().getList();
	let file = list.getSelection({multi:false});
	if (file.supports(CHILDREN) || !file.supports(READ)) { return; }

	viewers.view(file, list);
});

command.register("file:edit", "F4", () => {
	let file = panes.getActive().getList().getSelection({multi:false});
	if (!file.supports(WRITE)) { return; }

	let bin = settings.get("editor.bin");
	let child = require("child_process").spawn(bin, [file]);

	child.on("error", e => alert(e.message));
});

command.register("file:delete", ["F8", "Delete", "Shift+Delete"], async () => {
	let list = panes.getActive().getList();
	let path = list.getSelection({multi:true});
	if (!path.supports(WRITE)) { return; }

	let result = await confirm(`Really delete "${path}" ?`);
	if (!result) { return; }
	let d = new Delete(path);
	await d.run();

	pubsub.publish("path-change", null, {path: list.getPath()});
});

command.register("file:rename", "F2", () => {
	let list = panes.getActive().getList();
	let file = list.getSelection({multi:false});
	if (!file.supports(WRITE)) { return; }
	list.startEditing();
});

command.register("file:copy", "F5", async () => {
	let sourceList = panes.getActive().getList();
	let sourcePath = sourceList.getSelection({multi:true});
	let targetList = panes.getInactive().getList();
	let targetPath = targetList.getPath();

	if (!sourcePath.supports(READ)) { return; }

	/* fixme parent->child test */

	let name = await prompt(`Copy "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = paths.fromString(name);
	let copy = new Copy(sourcePath, targetPath);
	await copy.run();

	sourceList.clearSelection();
	pubsub.publish("path-change", null, {path:targetPath});
});

command.register("file:move", "F6", async () => {
	let sourceList = panes.getActive().getList();
	let sourcePath = sourceList.getSelection({multi:true});
	let targetList = panes.getInactive().getList();
	let targetPath = targetList.getPath();

	if (!sourcePath.supports(READ)) { return; }
	if (!sourcePath.supports(WRITE)) { return; }

	/* fixme parent->child test */

	let name = await prompt(`Move "${sourcePath}" to:`, targetPath);
	if (!name) { return; }
	targetPath = paths.fromString(name);
	let move = new Move(sourcePath, targetPath);
	await move.run();

	pubsub.publish("path-change", null, {path:sourceList.getPath()});
	pubsub.publish("path-change", null, {path:targetPath});
});

command.register("app:devtools", "F12", () => {
	require("electron").remote.getCurrentWindow().toggleDevTools();
});

command.register("app:settings", [], () => {
	settingsWindow.open();
});

command.register("app:terminal", [], () => {
	let bin = settings.get("terminal.bin");
	let path = panes.getActive().getList().getPath();
	let args = settings.get("terminal.args").split(" ").map(arg => arg.replace("%s", path.toString()));
	console.log(bin, args);
	let child = require("child_process").spawn(bin, args);
	child.on("error", e => alert(e.message));
});
