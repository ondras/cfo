import * as pubsub from "util/pubsub.js";
import * as html from "util/html.js";

export default class Tabs {
	constructor() {
		this._node = html.node("div");
		this._list = html.node("ul", {className:"tabs"});
		this._selectedIndex = -1;
	}

	getNode() { return this._node; }
	getList() { return this._list; }

	handleEvent(e) {
		let all = Array.from(this._list.children);
		let index = all.indexOf(e.target);
		if (index != -1) { this.selectedIndex = index; }
	}

	add(content) {
		this._node.appendChild(content);
		content.style.display = "none";

		let li = html.node("li");
		this._list.appendChild(li);

		li.addEventListener("click", this);

		return li;
	}

	remove(index) {
		let content = this._node.children[index];
		content.parentNode.removeChild(content);

		let li = this._list.children[index];
		li.parentNode.removeChild(li);
	}

	get selectedIndex() { return this._selectedIndex; }

	set selectedIndex(index) {
		if (index == this._selectedIndex) { return; }

		let messageData = {
			oldIndex: this._selectedIndex,
			newIndex: index
		}

		if (this._selectedIndex > -1) {
			this._list.children[this._selectedIndex].classList.remove("active");
			this._node.children[this._selectedIndex].style.display = "none";
		}

		this._selectedIndex = index;

		if (this._selectedIndex > -1) {
			this._list.children[this._selectedIndex].classList.add("active");
			this._node.children[this._selectedIndex].style.display = "";
		}

		pubsub.publish("tab-change", this, messageData);
	}
}
