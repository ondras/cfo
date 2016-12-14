import * as keyboard from "./keyboard.js";
import * as pubsub from "./pubsub.js";

const document = window.document;
const registry = Object.create(null);

function syncDisabledAttribute(command) {
	let enabled = registry[command].enabled;
	let nodes = Array.from(document.querySelectorAll(`[data-command='${command}']`));

	nodes.forEach(n => n.disabled = !enabled);
}

export function register(command, keys, func) {
	function wrap() {
		if (isEnabled(command)) {
			func(command);
			return true;
		} else {
			return false;
		}
	}

	registry[command] = {
		func: wrap,
		enabled: true
	};

	[].concat(keys || []).forEach(key => keyboard.register(wrap, key));

	return command;
}

export function enable(command) {
	Object.keys(registry)
		.filter(c => c.match(command))
		.forEach(c => {
			registry[c].enabled = true;
			syncDisabledAttribute(c);
		});

	pubsub.publish("command-enable", command);
}

export function disable(command) {
	Object.keys(registry)
		.filter(c => c.match(command))
		.forEach(c => {
			registry[c].enabled = false;
			syncDisabledAttribute(c);
		});
	pubsub.publish("command-disable", command);
}

export function isEnabled(command) {
	return registry[command].enabled;
}

export function execute(command) {
	return registry[command].func();
}

document.body.addEventListener("click", e => {
	let node = e.target;
	while (node) {
		let c = node.getAttribute("data-command");
		if (c) { return execute(c); }
		if (node == event.currentTarget) { break; }
		node = node.parentNode;
	}
});
