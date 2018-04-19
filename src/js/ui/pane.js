import List from "ui/list.js";
import Tabs from "ui/tabs.js";

import * as panes from "panes.js";
import * as pubsub from "util/pubsub.js";
import * as html from "util/html.js";
import * as paths from "path/paths.js";

function parsePaths(saved) {
	return saved ? saved.map(paths.fromString) : [paths.home()];
}

export default class Pane {
	constructor(saved = {}) {
		this._active = false;
		this._lists = [];
		this._tabs = new Tabs();
		this._labels = [];
		this._node = html.node("div", {className:"pane"});

		this._node.addEventListener("click", this, true); // capture phase: before the list's table processes the event

		this._node.appendChild(this._tabs.getList());
		this._node.appendChild(this._tabs.getNode());

		pubsub.subscribe("tab-change", this);
		pubsub.subscribe("list-change", this);

		let paths = parsePaths(saved.paths);
		paths.forEach(path => this.addList(path));
		this._tabs.selectedIndex = saved.index || 0;
	}

	getNode() { return this._node; }

	toJSON() {
		return {
			index: this._tabs.selectedIndex,
			paths: this._lists.map(l => l.getPath().toString())
		}
	}

	activate() {
		if (this._active) { return; }
		this._active = true;
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].activate(); }
	}

	deactivate() {
		if (!this._active) { return; }
		this._active = false;
		let index = this._tabs.selectedIndex;
		if (index > -1) { this._lists[index].deactivate(); }
	}

	adjustTab(diff) {
		let index = this._tabs.selectedIndex;
		if (index > -1) { 
			index = (index + diff + this._lists.length) % this._lists.length; /* js negative modulus */
			this._tabs.selectedIndex = index;
		}
	}

	getList() {
		let index = this._tabs.selectedIndex;
		return (index > -1 ? this._lists[index] : null);
	}

	handleEvent(e) {
		panes.activate(this);
	}

	async addList(path) {
		if (!path) { /* either duplicate or home */
			let index = this._tabs.selectedIndex;
			if (index == -1) { throw new Error("Cannot add new list: no path specified and duplication is not possible"); }
			path = this._lists[index].getPath();
		}

		let list = new List();
		this._lists.push(list);

		let label = this._tabs.add(list.getNode());
		this._labels.push(label);

		this._tabs.selectedIndex = this._labels.length-1;

		let loaded = await list.setPath(path);
		if (!loaded) { list.setPath(paths.home()); }
	}

	removeList() {
		if (this._lists.length < 2) { return; }

		let index = this._tabs.selectedIndex;
		if (index == -1) { return; }

		let last = (index+1 == this._lists.length);
		this._tabs.selectedIndex = -1; /* deselect */

		this._labels.splice(index, 1);
		this._tabs.remove(index);

		let list = this._lists.splice(index, 1)[0];
		list.destroy();

		this._tabs.selectedIndex = (last ? index-1 : index);
	}

	handleMessage(message, publisher, data) {
		switch (message) {
			case "tab-change":
				if (publisher != this._tabs) { return; }
				if (!this._active) { return; }
				if (data.oldIndex > -1) { this._lists[data.oldIndex].deactivate(); }
				if (data.newIndex > -1) { this._lists[data.newIndex].activate(); }
			break;

			case "list-change":
				let index = this._lists.indexOf(publisher);
				if (index > -1) { 
					let path = publisher.getPath();
					if (path) {
						let label = this._labels[index];
						html.clear(label);
						label.appendChild(html.text(path.getName()));
					}
				}
			break;
		}
	}
}

