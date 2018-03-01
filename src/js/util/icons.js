import * as html from "util/html.js";
import * as faenza from "./icons/faenza.js"
import * as numix from "./icons/numix.js"
import * as settings from "util/settings.js";

const THEMES = {faenza, numix};
const SIZE = 16;
const THEME = THEMES[settings.get("icons")];

const LOCAL = ["link"];

const KEYWORD = {
	"folder": {
		type: "place",
		name: "folder"
	},
	"file": {
		type: "mime",
		name: "text-plain"
	},
	"up": {
		type: "action",
		name: "go-up"
	},
	"favorite": {
		type: "emblem",
		name: "emblem-favorite"
	},
	"broken": {
		type: "action",
		name: "gtk-cancel"
	}
}

let cache = Object.create(null);
let link = null;

async function createImage(src) {
	let img = html.node("img", {src});
	return new Promise((resolve, reject) => {
		img.onload = e => resolve(img);
		img.onerror = reject;
	});
}

function createCacheKey(name, options) {
	return `${name}${options.link ? "-link" : ""}`;
}

function nameToPath(name) {
	let path;
	if (name.indexOf("/") == -1) { // keyword
		if (LOCAL.indexOf(name) > -1) { return `../img/${name}.png`; } // local image
		path = KEYWORD[name]; // keyword-to-mimetype mapping
	} else {
		path = {name, type:"mime"};
	}
	return THEME.formatPath(path);
}

async function createIcon(name, options) {
	let canvas = html.node("canvas", {width:SIZE, height:SIZE});
	let ctx = canvas.getContext("2d");

	let path = nameToPath(name);
	let image;

	try {
		image = await createImage(path);
	} catch (e) {
		console.warn("No icon found for", name);
		image = await createImage(nameToPath("file"));
	}

	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
	if (options.link) {
		if (!link) { 
			link = await createIcon("link", {link:false});
		}
		ctx.drawImage(link, 0, SIZE - link.height);
	}

	return canvas;
}

function drawCached(canvas, cached) {
	canvas.width = cached.width;
	canvas.height = cached.height;
	canvas.getContext("2d").drawImage(cached, 0, 0);
}

export function create(name, options = {}) {
	let canvas = html.node("canvas", {width:SIZE, height:SIZE});
	let key = createCacheKey(name, options);

	if (key in cache) { // cached image or Promise
		let cached = cache[key];
		if (cached instanceof Promise) { // cached Promise
			cached.then(icon => drawCached(canvas, icon));
		} else { // cached image
			drawCached(canvas, cached);
		}
	} else { // cache empty
		let cached = createIcon(name, options).then(icon => cache[key] = icon);
		cache[key] = cached;
		cached.then(icon => drawCached(canvas, icon));
	}

	return canvas;
}
