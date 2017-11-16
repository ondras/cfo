import * as html from "util/html.js";

const SIZE = 16;
const EXT = "svg";

// fixme vyzkouset Faenza

/* papirus
const THEME = "papirus";
const EXT = "svg";
/**/

/* xfce 
const THEME = "xubuntu-artwork/usr/share/icons/elementary-xfce";
const EXT = "png";
/**/

/* wildfire 
const THEME = "wildfire/icons/Xenlism-Wildfire";
const EXT = "svg";
/**/

/* oxygen 
const THEME = "oxygen-icons5";
const EXT = "png";
/**/

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
	"up": { // fixme najit hezci?
		type: "action",
		name: "go-up"
	},
	"favorite": {
		type: "emblem",
		name: "emblem-favorite"
	},
}
const TYPE = {
	"mime": "mimetypes",
	"place": "places",
	"action": "actions",
	"emblem": "emblems"
}
const FALLBACK = {
	"audio/wav": "audio/x-wav",
	"application/x-httpd-php": "application/x-php",
	"application/x-sh": "application/x-shellscript",
	"audio/ogg": "audio/x-vorbis+ogg",
	"text/less": "text/x-scss",
	"application/x-sql": "application/sql",
	"application/font-woff": "font/woff"
}

// FIXME: text/yaml, application/vnd.ms-fontobject

let cache = Object.create(null);
let link = null;

function formatPath(path) {
	let name = path.name;
	if (name in FALLBACK) { name = FALLBACK[name]; }
	name = name.replace(/\//g, "-");
	return `../img/icons/${TYPE[path.type]}/${name}.${EXT}`;
}

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
	let path;
	if (name.indexOf("/") == -1) { // keyword
		if (LOCAL.indexOf(name) > -1) { return `../img/${name}.png`; } // local image
		path = KEYWORD[name]; // keyword-to-mimetype mapping
	} else {
		path = {name, type:"mime"};
	}
	return formatPath(path);
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

	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
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
	canvas.width = cached.width;
	canvas.height = cached.height;
	canvas.getContext("2d").drawImage(cached, 0, 0);
}

export function create(name, options = {}) {
	let canvas = html.node("canvas", {width:SIZE, height:SIZE});
	let key = createCacheKey(name, options);

	if (key in cache) { // fixme already pending?
		drawFromCache(canvas, key);
	} else {
		createIcon(name, options).then(icon => {
			cache[key] = icon;
			drawFromCache(canvas, key);
		});
	}

	return canvas;
}
