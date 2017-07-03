import * as keyboard from "util/keyboard.js";
import * as panes from "panes.js";
import * as paths from "path/paths.js";
import confirm from "ui/confirm.js";

const {remote} = require('electron');
const settings = remote.require('electron-settings');
const COUNT = 10;

let storage = []; // strings

function viewFunc(i) {
	return async () => {
		console.log(i);
		let path = get(i);
		if (!path) { return; }
		panes.getActive().getList().setPath(path);
	};
}

function setFunc(i) {
	return async () => {
		let path = panes.getActive().getList().getPath();
		let result = await confirm(`Set "${path}" as favorite? It will be accessible as Ctrl+${i}.`);
		if (!result) { return; }
		set(path, i);
	}
}

export function init(saved) {
	for (let i=0; i<10; i++) {
		let str = saved[i];
		storage[i] = str ? paths.fromString(str) : null;

		keyboard.register(viewFunc(i), `Ctrl+Digit${i}`);
		keyboard.register(setFunc(i), `Ctrl+Shift+Digit${i}`);
	}
}

export function toJSON() { return storage.map(path => path && path.toString()); }
export function list() { return storage; }
export function set(path, index) { storage[index] = path; }
export function get(index) { return storage[index]; }
export function remove(index) { storage[index] = null; }
