import * as command from "util/command.js";
import * as settings from "util/settings.js";

function isBool(input) {
	return (input.type == "radio" || input.type == "checkbox");
}

function fromForm(name) {
	let node = findName(name);
	let value = (isBool(node) ? node.checked : node.value);
	settings.set(name, value);
}

function toForm(name) {
	let node = findName(name);
	let value = settings.get(name);
	if (isBool(node)) {
		node.checked = value;
	} else {
		node.value = value;
	}
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
	if (isBool(node)) {
		node.addEventListener("click", onInput);
	} else {
		node.addEventListener("input", onInput);
	}
}

function init() {
	let names = Array.from(document.querySelectorAll("[name]")).map(n => n.name);
	names.forEach(initName);
	command.register("window:close", "Escape", () => window.close());
}

init();
