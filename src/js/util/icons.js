import * as html from "util/html.js";

const NAMES = ["folder", "file", "favorite", "up", "link"];

let images = Object.create(null);
let cache = Object.create(null);

async function createImage(name) {
	let src = `../img/${name}.png`;
	let img = html.node("img", {src})
	images[name] = img;
	return new Promise((resolve, reject) => {
		img.onload = resolve;
		img.onerror = reject;
	});
}

function createCacheKey(name, options) {
	return `${name}${options.link ? "-link" : ""}`;
}

function serialize(canvas) {
	let url = canvas.toDataURL();

	let binStr = atob(url.split(",").pop());
	let len = binStr.length;
	let arr = new Uint8Array(len);
	for (let i=0; i<len; i++) { arr[i] = binStr.charCodeAt(i); }

    let blob = new Blob([arr], {type: "image/png"});
	return URL.createObjectURL(blob);
}

function createIcon(name, options) {
	let image = images[name];
	let canvas = html.node("canvas", {width:image.width, height:image.height});

	let ctx = canvas.getContext("2d");

	ctx.drawImage(image, 0, 0);
	if (options.link) {
		let link = images["link"];
		ctx.drawImage(link, 0, image.height - link.height);
	}

	return serialize(canvas);
}

export async function init() {
	let promises = NAMES.map(createImage);
	return Promise.all(promises);
}

export function get(name, options = {}) {
	let key = createCacheKey(name, options);
	if (!(key in cache)) { cache[key] = createIcon(name, options); }
	return cache[key];
}
