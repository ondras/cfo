import Local from "./local.js";

const {app} = require("electron").remote;

export function fromString(str) {
	return new Local(str);
}

export function home() {
	return fromString(app.getPath("home"));
}

