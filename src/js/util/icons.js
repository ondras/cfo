import * as html from "util/html.js";

const SIZE = 16;
const THEME = "gnome";
const PATH = `/usr/share/icons/${THEME}/${SIZE}x${SIZE}`;
const EXT = "png";

const LOCAL = ["up", "favorite", "link", "folder"]; // fixme folder je tu 2x
const KEYWORD = {
	"folder": "places/folder",
	"file": "mimetypes/gtk-file"
}

let cache = Object.create(null);
let link = null;

/*
function serialize(canvas) {
	let url = canvas.toDataURL();

	let binStr = atob(url.split(",").pop());
	let len = binStr.length;
	let arr = new Uint8Array(len);
	for (let i=0; i<len; i++) { arr[i] = binStr.charCodeAt(i); }

    let blob = new Blob([arr], {type: "image/png"});
	return URL.createObjectURL(blob);
}
*/

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
	if (name.indexOf("/") == -1) { // not a mime type
		if (LOCAL.indexOf(name) > -1) { return `../img/${name}.png`; } // local image
		name = KEYWORD[name]; // keyword-to-mimetype mapping
	} else {
		name = name.replace(/\//g, "-");
		name = `mimetypes/${name}`; // valid mime type
	}
	let path = `${PATH}/${name}.${EXT}`;
	return path;
}

async function createIcon(name, options) {
	let canvas = html.node("canvas", {width:SIZE, height:SIZE});
	let ctx = canvas.getContext("2d");

	let path = nameToPath(name);
	let image;

	try {
		image = await createImage(path);
	} catch (e) {
		image = await createImage(nameToPath("file"));
	}

	ctx.drawImage(image, 0, 0);
	if (options.link) {
		if (!link) { 
			link = await createIcon("link", {link:false});
		}
		ctx.drawImage(link, 0, SIZE - link.height);
	}

	return canvas;
}

function drawFromCache(canvas, key) {
	let cached = cache[key];
	canvas.getContext("2d").drawImage(cached, 0, 0);
}

export function create(name, options = {}) {
	let canvas = html.node("canvas", {width:SIZE, height:SIZE});
	let key = createCacheKey(name, options);

	if (key in cache) { 
		drawFromCache(canvas, key);
	} else {
		createIcon(name, options).then(icon => {
			cache[key] = icon;
			drawFromCache(canvas, key);
		});
	}

	return canvas;
}
