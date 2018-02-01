import * as html from "util/html.js";
import * as command from "util/command.js";
import * as paths from "path/paths.js";
import * as settings from "util/settings.js";

function fromForm(name) {
	let node = findName(name);
	let value = node.value;
	settings.set(name, value);
}

function toForm(name) {
	let node = findName(name);
	let value = settings.get(name);
	node.value = value;
}

function onInput(e) {
	let node = e.target;
	fromForm(node.name);
}

function findName(name) {
	return document.querySelector(`[name='${name}']`);
}

function initName(name) {
	toForm(name);
	let node = findName(name);
	node.addEventListener("input", onInput);
}

function init() {
	let names = Array.from(document.querySelectorAll("[name]")).map(n => n.name);
	names.forEach(initName);
	command.register("window:close", "Escape", () => window.close());
}

init();
