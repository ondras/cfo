import Up from "path/up.js";
import {CHILDREN} from "path/path.js";
import * as html from "util/html.js";
import * as format from "util/format.js";

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

		this._node = document.createElement("div");
		this._node.classList.add("list");
		this._table = document.createElement("table");
		this._node.appendChild(this._table);
		document.body.appendChild(this._node);

		document.addEventListener("keydown", this);
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

	handleEvent(e) {
		let handled = this.handleKey(e.key);
		if (handled) { e.preventDefault(); }
	}

	handleKey(key) {
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

			case "Enter":
				let path = this._getFocusedPath();
				if (path.supports(CHILDREN)) {
					this.setPath(path);
				} else {
					path.activate();
				}
			break;

			default:
				return false;
			break;
		}

		return true;
	}

	_show(paths, path) {
		let oldPath = this._path;

		this._clear();

		this._path = path;
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
			node.insertCell().innerHTML = path.getName();

			let size = path.getSize();
			node.insertCell().innerHTML = (size === undefined ? "" : format.size(size));

			let date = path.getDate();
			node.insertCell().innerHTML = (date === undefined ? "" : format.date(date));

			let mode = path.getMode();
			node.insertCell().innerHTML = (mode === undefined ? "" : format.mode(mode));

			return {node, path};
		});
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
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		return this._focusAt(index);
	}

	_focusBy(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		index = (index + diff + this._items.length) % this._items.length; // js modulus
		return this._focusAt(index);
	}

	_focusAt(index) {
		let oldIndex = this._getFocusedIndex();
		if (oldIndex > -1) { this._items[oldIndex].node.classList.remove("focus"); }
		if (index > -1) { 
			let node = this._items[index].node;
			node.classList.add("focus");
			html.scrollIntoView(node, this._node);
		}
	}

	_clear() {
		this._path = null;
		this._pendingPath = null;
		this._items = [];
		this._table.innerHTML = "";
	}
}
