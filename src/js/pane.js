import LocalPath from "path/local.js";
import List from "list.js";
import Tabs from "tabs.js";

import * as panes from "panes.js";
import * as pubsub from "util/pubsub.js";
import * as html from "util/html.js";

export default class Pane {
	constructor() {
		this._active = false;
		this._lists = [];
		this._tabs = new Tabs();
		this._labels = [];
		this._node = html.node("div", {className:"pane"});

		this._node.addEventListener("click", this);

		this._node.appendChild(this._tabs.getList());
		this._node.appendChild(this._tabs.getNode());

		pubsub.subscribe("tab-change", this);
		pubsub.subscribe("list-change", this);

		this.addList();
	}

	getNode() { return this._node; }

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

	addList(path) {
		if (!path) { /* either duplicate or home */
			let index = this._tabs.selectedIndex;
			path = (index == -1 ? LocalPath.home() : this._lists[index].getPath());
		}

		let list = new List();
		this._lists.push(list);

		let label = this._tabs.add(list.getNode());
		this._labels.push(label);

		this._tabs.selectedIndex = this._labels.length-1;

		list.setPath(path); 
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

