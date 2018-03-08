const settings = require("electron-settings");

const defaults = {
	"favorites": [],
	"panes": {},
	"editor.bin": "/usr/bin/subl",
	"newfile": "new.txt",
	"terminal.bin": "/usr/bin/xfce4-terminal",
	"terminal.args": `--working-directory=%s`,
	"icons": "faenza",
	"autosize": false
}

export function get(key) {
	return settings.get(key, defaults[key]);
}

export function set(key, value) {
	return settings.set(key, value);
}
