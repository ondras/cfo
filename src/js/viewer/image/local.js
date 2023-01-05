/* Image viewer window - local (ui) part */

import * as html from "util/html.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";

const electron = require("electron");
const SCALES = [1/40, 1/30, 1/20, 1/16, 1/12, 1/10, 1/8, 1/6, 1/4, 1/3, 1/2, 2/3, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 30, 40];
const image = document.querySelector("img");

let scale = null;
let size = null;
let position = null;

let currentIndex = -1;
let allImages = [];

function syncSize() {
	if (!image.complete) { return; }
	let box = image.parentNode;
	let avail = [box.offsetWidth, box.offsetHeight];
	size = [image.naturalWidth, image.naturalHeight];

	if (scale === null) { /* auto size */
		let rx = size[0]/avail[0];
		let ry = size[1]/avail[1];
		let r = Math.max(rx, ry);
		if (r > 1) {
			size[0] /= r;
			size[1] /= r;
		}
	} else {
		let coef = SCALES[scale];
		size[0] *= coef;
		size[1] *= coef;
	}

	position = [
		(avail[0]-size[0])/2,
		(avail[1]-size[1])/2
	];

	image.style.width = `${Math.round(size[0])}px`;
	image.style.height = `${Math.round(size[1])}px`;
	image.style.left = `${Math.round(position[0])}px`;
	image.style.top = `${Math.round(position[1])}px`;

	let percent = Math.round(100*(size[0]/image.naturalWidth));
	let win = electron.remote.getCurrentWindow();
	let path = allImages[currentIndex];
	win.setTitle(`(${percent}%) ${path}`);

	document.querySelector(".scale").textContent = `${percent}%`;
}

function findScale(diff) {
	let frac = size[0]/image.naturalWidth;
	let index = (diff > 0 ? 0 : SCALES.length-1);

	while (index >= 0 && index < SCALES.length) {
		if (diff * (SCALES[index] - frac) > 0) { return index; }
		index += diff;
	}

	return null;
}

function zoom(diff) {
	if (scale === null) {
		scale = findScale(diff);
		syncSize();
	} else {
		let s = scale + diff;
		if (s >= 0 && s+1 < SCALES.length) {
			scale = s;
			syncSize();
		}
	}
}

function moveBy(diff) {
	let amount = 20;
	let props = ["left", "top"];
	let box = image.parentNode;
	let avail = [box.offsetWidth, box.offsetHeight];
	props.forEach((prop, i) => {
		let pos = position[i];
		if (pos > 0) { return; } /* centered */

		pos += diff[i]*amount;
		pos = Math.min(pos, 0);
		pos = Math.max(pos, avail[i]-size[i]);
		position[i] = pos;
		image.style[prop] = `${Math.round(pos)}px`;
	});
}

function onMouseMove(e) {
	if (!image.complete) { return; }
	let frac = image.naturalWidth / size[0];
	let pos = [e.clientX, e.clientY]
		.map((mouse, i) => frac*(mouse - position[i]))
		.map(Math.round);

	document.querySelector(".mouse").textContent = pos.join(",");
}

function loadAnother(diff) {
	let index = currentIndex + diff;
	index = Math.max(index, 0);
	index = Math.min(index, allImages.length-1);
	if (index != currentIndex) { load(index); }
}

function onLoad(e) {
	document.body.classList.remove("loading");
	document.querySelector(".size").textContent = [image.naturalWidth, image.naturalHeight].join("×");
	syncSize();
}

function load(i) {
	currentIndex = i;
	scale = null;
	document.body.classList.add("loading");

	let parts = allImages[currentIndex].toString().split("/");
	image.src = parts.map(encodeURIComponent).join("/");
}

electron.ipcRenderer.on("path", (e, all, i) => {
	allImages = all.map(paths.fromString);
	load(i);
});

image.addEventListener("load", onLoad);
window.addEventListener("resize", syncSize);
window.addEventListener("mousemove", onMouseMove);

command.register("window:close", "Escape", () => {
	window.close();
});
// FIXME plus nefunguje se shift
command.register("image:zoomin", "+", () => zoom(+1));
command.register("image:zoomout", "-", () => zoom(-1));
command.register("image:fit", "*", () => {
	scale = null;
	syncSize();
});

command.register("image:left", "ArrowLeft", () => moveBy([1, 0]));
command.register("image:right", "ArrowRight", () => moveBy([-1, 0]));
command.register("image:up", "ArrowUp", () => moveBy([0, 1]));
command.register("image:down", "ArrowDown", () => moveBy([0, -1]));

command.register("image:full", "Enter", () => {
	let win = electron.remote.getCurrentWindow();
	win.setFullScreen(!win.isFullScreen());
	syncSize();
});

command.register("image:next", ["PageDown", " "], () => loadAnother(+1));
command.register("image:prev", ["PageUp", "Backspace"], () => loadAnother(-1));
command.register("image:prev", "Home", () => loadAnother(-Infinity));
command.register("image:prev", "End", () => loadAnother(+Infinity));
