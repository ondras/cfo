import Local from "./local.js";
import Favorites from "./favorites.js";
import Group from "./group.js";

const {app} = require("electron").remote;
const ALL = [Favorites, Local];

export function fromString(str) {
	let ctors = ALL.filter(ctor => ctor.match(str));
	if (!ctors.length) { throw new Error(`No Path available to handle "${str}"`); }
	let Ctor = ctors.shift();
	return new Ctor(str);
}

export function home() {
	return fromString(app.getPath("home"));
}

export function favorites() {
	return new Favorites();
}

export function group(paths) {
	return new Group(paths);
}