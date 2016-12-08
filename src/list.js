import Up from "path/up.js";
import {CHILDREN} from "path/path.js";

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

		this._table = document.createElement("table");
		document.body.appendChild(this._table);

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
		this.handleKey(e.key);
	}

	handleKey(key) {
		switch (key) {
			case "Home": this._focusAt(0); break;
			case "End": this._focusAt(this._items.length-1); break;
			case "ArrowUp": this._focusBy(-1); break;
			case "ArrowDown": this._focusBy(+1); break;

			case "Enter":
				let path = this._getFocusedPath();
				if (path.supports(CHILDREN)) {
					this.setPath(path);
				} else {
					path.activate();
				}
			break;
		}
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

	_focusBy(diff) {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		index = (index + diff + this._items.length) % this._items.length; // js modulus
		return this._focusAt(index);
	}

	_focusAt(index) {
		let oldIndex = this._getFocusedIndex();
		if (oldIndex > -1) { this._items[oldIndex].node.classList.remove("focus"); }
		if (index > -1) { this._items[index].node.classList.add("focus"); }
	}

	_clear() {
		this._path = null;
		this._pendingPath = null;
		this._items = [];
		this._table.innerHTML = "";
	}
}
