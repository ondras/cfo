import * as pubsub from "util/pubsub.js";
import * as html from "util/html.js";

function randomId() {
	return `i${Math.random().toString().replace(/\D/g, "")}`;
}

export default class Tabs {
	constructor() {
		this._node = html.node("div");
		this._list = html.node("ul");
		this._name = randomId;
	}

	getNode() {
		return this._node;
	}

	getList() {
		return this._list;
	}

	add(content) {
		this._node.appendChild(content);

		let id = randomId();
		let radio = html.node("input", {type:"radio", name:this._name, id});

		let li = html.node("li");
		this._list.appendChild(li);

		let label = html.node("label", {htmlFor:id});
		li.appendChild(label);
		label.innerHTML = "testik";

		return label;
	}
}
