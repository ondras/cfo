import Local from "./local.js";
import Favorites from "./favorites.js";
import Group from "./group.js";

const remote = require("electron").remote;
const ALL = [Favorites, Local];
const CLIP_PREFIX = "file://";

export function fromString(str) {
	let ctors = ALL.filter(ctor => ctor.match(str));
	if (!ctors.length) { throw new Error(`No Path available to handle "${str}"`); }
	let Ctor = ctors.shift();
	return new Ctor(str);
}

export function toClipboard(path) {
	return `${CLIP_PREFIX}${path}`;
}

export function fromClipboard(name) {
	if (name.indexOf(CLIP_PREFIX) == 0) {
		return fromString(name.substring(CLIP_PREFIX.length));
	} else {
		return null;
	}
}

export function home() {
	return fromString(remote.app.getPath("home"));
}

export function favorites() {
	return new Favorites();
}

export function group(paths) {
	return new Group(paths);
}

export function isGroup(path) {
	return path instanceof Group;
}