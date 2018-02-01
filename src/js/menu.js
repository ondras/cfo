import * as command from "util/command.js";

const Menu = require('electron').remote.Menu;

export function init() {
	const template = [
		{
			label: "&File",
			submenu: [
				command.menuItem("file:rename", "&Quick rename"),
				command.menuItem("file:view", "&View"),
				command.menuItem("file:edit", "&Edit"),
				command.menuItem("file:new", "Edit &new file"),
				command.menuItem("file:copy", "&Copy"),
				command.menuItem("file:move", "&Move"),
				command.menuItem("file:delete", "&Delete"),
				{type: "separator"},
				{role: "quit"}
			]
		},
		{
			label: "&Go",
			submenu: [
				command.menuItem("list:up", "Go to &parent"),
				command.menuItem("list:top", "Go to &top"),
				command.menuItem("fixme", "&Drive selection"),
				command.menuItem("fixme", "&Wi-Fi Access points"),
				command.menuItem("list:favorites", "&Favorites"),
				command.menuItem("list:home", "&Home")
			]
		},
		{
			label: "&Commands",
			submenu: [
				command.menuItem("directory:new", "Create &directory"),
				command.menuItem("tab:new", "&New tab"),
				command.menuItem("tab:close", "&Close tab"),
				command.menuItem("fixme", "&Search"),
				command.menuItem("fixme", "Create &archive"),
				{type: "separator"}, /* fixme sort? */
				command.menuItem("app:terminal", "O&pen terminal"),
				command.menuItem("app:settings", "&Options")
			]
		},
		{
			label: "&Help",
			submenu: [
				{
					label: "&About"
				},
				command.menuItem("app:devtools", "Toggle &Devtools")
			]
		}
	]

	let menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}
