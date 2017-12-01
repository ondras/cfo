import * as keyboard from "./keyboard.js";
import * as pubsub from "./pubsub.js";

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

	keys = [].concat(keys || []);

	registry[command] = {
		func: wrap,
		enabled: true,
		key: keys[0]
	};

	keys.forEach(key => keyboard.register(wrap, key));

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

export function menuItem(command, label) {
	let click = () => execute(command);
	let accelerator = null;
	if (command in registry) { accelerator = registry[command].key; }

	return { label, click, accelerator };
}
