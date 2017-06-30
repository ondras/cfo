import * as command from "util/command.js";

const Menu = require('electron').remote.Menu;

const template = [
	{
		label: "File",
		submenu: [
			command.menuItem("xxx", "Quick rename"),
			command.menuItem("xxx", "View"),
			command.menuItem("xxx", "Edit"),
			command.menuItem("xxx", "Edit new file"),
			command.menuItem("xxx", "Copy"),
			command.menuItem("xxx", "Move"),
			command.menuItem("xxx", "Delete"),
			{type: "separator"},
			{role: "quit"}
		]
	},
	{
		label: "Go",
		submenu: [
		]
	},
	{
		label: "Commands",
		submenu: [
		]
	},
	{
		label: "Help",
		submenu: [
			{
				label: "About"
			}
		]
	}
]

export function init() {
	let menu = Menu.buildFromTemplate(template);
	/*
const menu = new Menu();
let i1 = new MenuItem({label: 'MenuItem1', click() { console.log('item 1 clicked') }});
menu.append(i1);


const x = new Menu();
let tmp = new MenuItem({label:"xxxx", accelerator:"Ctrl+A", click() { console.log("xxx"); }});
x.append(tmp);

tmp = new MenuItem({label:"wwww", accelerator:"F3", click() { console.log("www"); }});
x.append(tmp);

menu.append(new MenuItem({label:"yyy", submenu:x}));

x.append(new MenuItem({type: 'separator'}));
x.append(new MenuItem({label: 'MenuItem2', type: 'checkbox', checked: true}));
*/
	Menu.setApplicationMenu(menu);
}
