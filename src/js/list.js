import Local from "path/local.js";
import Up from "path/up.js";
import {CHILDREN} from "path/path.js";
import * as html from "util/html.js";
import * as format from "util/format.js";
import * as status from "status.js";

const TEMPLATE = document.querySelector("#list");

function SORT(a, b) {
	let childScoreA = (a.supports(CHILDREN) ? 1 : 2);
	let childScoreB = (b.supports(CHILDREN) ? 1 : 2);
	if (childScoreA != childScoreB) { return childScoreA - childScoreB; }

	return a.getName().fileLocaleCompare(b.getName());
}

export default class List {
	constructor() {
		this._path = null;
		this._pendingPath = null; /* trying to list this one (will be switched to _path afterwards) */
		this._items = [];

		let dom = TEMPLATE.content.cloneNode(true);

		this._node = dom.querySelector(".list");
		this._scroll = dom.querySelector(".scroll");
		this._table = dom.querySelector("table");
		this._input = dom.querySelector("input");

		this._table.addEventListener("click", this);
		this._table.addEventListener("dblclick", this);
	}

	destroy() {

	}

	getNode() {
		return this._node;
	}

	setPath(path) {
		this._pendingPath = path;
		path.getChildren().then(paths => {
			if (!this._pendingPath.is(path)) { return; } /* got a new one in the meantime */
			this._show(paths, path);
		}, e => {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
		});
	}

	focus() {
		document.addEventListener("keydown", this);
	}

	blur() {
		document.removeEventListener("keydown", this);
	}

	handleEvent(e) {
		switch (e.type) {
			case "click":
				let index = this._nodeToIndex(e.target);
				if (index != -1) { this._focusAt(index); }
			break;

			case "dblclick":
				this._activate();
			break;

			case "keydown":
				if (e.target == this._input) { 
					this._handleInputKey(e.key);
				} else {
					let handled = this._handleKey(e.key);
					if (handled) { e.preventDefault(); }
				}
			break;
		}
	}

	_handleInputKey(key) {
		switch (key) {
			case "Enter":
				this._input.blur();
				let path = new Local(this._input.value);
				this.setPath(path);
			break;

			case "Escape":
				this._input.blur();
			break;
		}
	}

	_handleKey(key) {
		switch (key) {
			case "Home": this._focusAt(0); break;
			case "End": this._focusAt(this._items.length-1); break;
			case "ArrowUp": this._focusBy(-1); break;
			case "ArrowDown": this._focusBy(+1); break;
			case "PageUp": this._focusByPage(-1); break;
			case "PageDown": this._focusByPage(+1); break;

			case "Backspace":
				let parent = this._path.getParent();
				parent && this.setPath(parent);
			break;

			case "Enter": this._activate(); break;

			default:
				return false;
			break;
		}

		return true;
	}

	_activate() {
		let path = this._getFocusedPath();
		if (path.supports(CHILDREN)) {
			this.setPath(path);
		} else {
			path.activate();
		}
	}

	_show(paths, path) {
		let oldPath = this._path;

		this._clear();

		this._path = path;
		this._input.value = path.getPath();
		paths.sort(SORT);

		let parent = this._path.getParent();
		if (parent) {
			let up = new Up(parent);
			paths.unshift(up);
		}

		this._items = this._build(paths);
		if (!paths.length) { return; }

		let focusIndex = this._items.reduce((result, item, index) => {
			return (oldPath && oldPath.is(item.path) ? index : result);
		}, 0);
		this._focusAt(focusIndex);
	}

	_build(paths) {
		return paths.map(path => {
			let node = this._table.insertRow();

			let td = node.insertCell();
			let img = html.node("img", {src:path.getImage()});
			td.appendChild(img);

			let name = path.getName();
			if (name) td.appendChild(html.text(name));

			let size = path.getSize();
			node.insertCell().innerHTML = (size === undefined ? "" : format.size(size));

			let date = path.getDate();
			node.insertCell().innerHTML = (date === undefined ? "" : format.date(date));

			let mode = path.getMode();
			node.insertCell().innerHTML = (mode === undefined ? "" : format.mode(mode));

			return {node, path};
		});
	}

	_nodeToIndex(node) {
		while (node && node.nodeName.toLowerCase() != "tr") { node = node.parentNode; }

		return this._items.reduce((result, item, index) => {
			return (item.node == node ? index : result);
		}, -1);
	}

	_getFocusedPath() {
		let index = this._getFocusedIndex();
		if (index == -1) { return null; }
		return this._items[index].path;
	}

	_getFocusedIndex() {
		let focused = this._table.querySelector(".focus");

		return this._items.reduce((result, item, index) => {
			return (item.node == focused ? index : result);
		}, -1);
	}

	_focusByPage(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		let sampleRow = this._items[0].node;
		let page = Math.floor(this._node.offsetHeight / sampleRow.offsetHeight);

		index += page*diff;

		return this._focusAt(index);
	}

	_focusBy(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		return this._focusAt(index + diff);
	}

	_focusAt(index) {
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		let oldIndex = this._getFocusedIndex();
		if (index == oldIndex) { return; }

		if (oldIndex > -1) { this._items[oldIndex].node.classList.remove("focus"); }
		if (index > -1) { 
			let node = this._items[index].node;
			node.classList.add("focus");
			html.scrollIntoView(node, this._scroll);

			status.set(this._items[index].path.getDescription());
		}
	}

	_clear() {
		this._path = null;
		this._pendingPath = null;
		this._items = [];
		this._table.innerHTML = "";
	}
}
