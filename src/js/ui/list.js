import Scan from "operation/scan.js";
import QuickEdit from "ui/quickedit.js";

import Local from "path/local.js";
import Up from "path/up.js";

import {CHILDREN} from "path/path.js";
import * as html from "util/html.js";
import * as format from "util/format.js";
import * as pubsub from "util/pubsub.js";
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
		this._active = false;
		this._path = null;

		/* we want to focus this path when possible: 
		  1) child after listing parent,
		  2) active item during blur
		*/
		this._pathToBeFocused = null; 
		this._items = [];

		this._prefix = ""; /* current search prefix */

		let dom = TEMPLATE.content.cloneNode(true);

		this._node = dom.querySelector(".list");
		this._scroll = dom.querySelector(".scroll");
		this._table = dom.querySelector("table");
		this._input = dom.querySelector("input");

		this._table.addEventListener("click", this);
		this._table.addEventListener("dblclick", this);

		this._quickEdit = new QuickEdit();
	}

	destroy() {

	}

	getNode() { return this._node; }
	getPath() { return this._path; }

	reload(pathToBeFocused) {
		this._pathToBeFocused = pathToBeFocused;
		this._loadPathContents(this._path);
	}

	setPath(path) {
		this._pathToBeFocused = this._path; // will try to focus it afterwards
		this._loadPathContents(path);
		pubsub.publish("list-change", this);
	}

	focusInput() {
		this._input.focus();
		this._input.selectionStart = 0;
		this._input.selectionEnd = this._input.value.length;
	}

	getFocusedPath() {
		let index = this._getFocusedIndex();
		if (index == -1) { return null; }
		return this._items[index].path;
	}

	activate() {
		if (this._active) { return; }

		this._active = true;
		document.addEventListener("keydown", this);

		this._focusPath(this._pathToBeFocused);
		this._pathToBeFocused = null;
		this._scroll.focus();
	}

	deactivate() {
		if (!this._active) { return; }
		this._active = false;
		document.removeEventListener("keydown", this);

		this._quickEdit.stop();

		this._pathToBeFocused = this.getFocusedPath();
		this._removeFocus();
		this._input.blur();
	}

	async startEditing() {
		let index = this._getFocusedIndex();
		if (index == -1) { return; }

		let {node, path} = this._items[index];
		let name = path.getName();

		let text = await this._quickEdit.start(name, node.cells[0]);
		if (text == name || text == "") { return; }
		let newPath = path.getParent().append(text);

		/* FIXME test na existenci! */
		try {
			await path.rename(newPath);
			this.reload(newPath);
		} catch (e) {
			alert(e.message);
		}

/*
		var data = _("rename.exists", newFile.getPath());
		var title = _("rename.title");
		if (newFile.exists() && !this._fc.showConfirm(data, title)) { return; }
		
*/
	}

	handleEvent(e) {
		switch (e.type) {
			case "click":
				let index = this._nodeToIndex(e.target);
				if (index != -1) { this._focusAt(index); }
			break;

			case "dblclick":
				this._activatePath();
			break;

			case "keydown":
				if (e.target == this._input) { 
					this._handleInputKey(e.key);
				} else if (!e.ctrlKey) { // nechceme aby ctrl+l hledalo od "l"
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

	async _handleKey(key) {
		let index = this._getFocusedIndex();

		switch (key) {
			case "Home": 
				this._prefix = "";
				this._focusAt(0);
			break;

			case "End":
				this._prefix = "";
				this._focusAt(this._items.length-1);
			break;

			case "ArrowUp":
				this._prefix = "";
				this._focusBy(-1);
			break;

			case "ArrowDown":
				this._prefix = "";
				this._focusBy(+1);
			break;

			case "PageUp":
				this._prefix = "";
				this._focusByPage(-1);
			break;

			case "PageDown":
				this._prefix = "";
				this._focusByPage(+1);
			break;

			case "Enter": this._activatePath(); break;

			case " ":
				if (index == -1) { return; }
				let item = this._items[index];

				/* FIXME 
				if (this._selection.selectionContains(item)) {
					this._toggleDown();
					return;
				}
				*/

				let scan = new Scan(item.path);
				let result = await scan.run();
				if (!result) { return; }
				item.size = result.size;

				html.clear(item.node);
				this._buildRow(item);

				this._prefix = "";
				this._focusBy(+1);
				// FIXME this._toggleDown();
			break;

			case "Escape":
				this._prefix = "";
				if (index > -1) { this._focusAt(index); } /* redraw without prefix highlight */
			break;

			default:
				if (key.length == 1) { this._search(key.toLowerCase()); }
				return false;
			break;
		}

		return true;
	}

	async _loadPathContents(path) {
		this._path = path;

		try {
			/* FIXME stat je tu jen proto, aby si cesta v metadatech nastavila isDirectory=true (kdyby se nekdo ptal na supports) */
			await path.stat();
			let paths = await path.getChildren();
			if (!this._path.is(path)) { return; } /* got a new one in the meantime */
			this._show(paths);
		} catch (e) {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
		}
	}

	_activatePath() {
		let path = this.getFocusedPath();
		if (!path) { return; }
		path.activate(this);
	}

	_show(paths) {
		this._clear();

		this._input.value = this._path.getPath();
		paths.sort(SORT);

		let parent = this._path.getParent();
		if (parent) {
			let up = new Up(parent);
			paths.unshift(up);
		}

		this._items = this._build(paths);
		if (!paths.length) { return; }

		if (this._active) {
			this._focusPath(this._pathToBeFocused);
			this._pathToBeFocused = null;
		}
	}

	_build(paths) {
		return paths.map(path => {
			let node = this._table.insertRow();
			let item = {node, path};

			this._buildRow(item);
			return item;
		});
	}

	_buildRow(item) {
		let {node, path} = item;

		let td = node.insertCell();
		let img = html.node("img", {src:path.getImage()});
		td.appendChild(img);

		let name = path.getName();
		if (name) { td.appendChild(html.text(name)); }

		let size = path.getSize();
		if (size === undefined) { size = item.size; } /* computed value (for directories) */
		node.insertCell().innerHTML = (size === undefined ? "" : format.size(size));

		let date = path.getDate();
		node.insertCell().innerHTML = (date === undefined ? "" : format.date(date));

		let mode = path.getMode();
		node.insertCell().innerHTML = (mode === undefined ? "" : format.mode(mode));
	}

	_nodeToIndex(node) {
		while (node && node.nodeName.toLowerCase() != "tr") { node = node.parentNode; }

		return this._items.reduce((result, item, index) => {
			return (item.node == node ? index : result);
		}, -1);
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

	_removeFocus() {
		let index = this._getFocusedIndex();
		if (index > -1) {
			let tr = this._items[index].node;
			tr.classList.remove("focus");

			/* remove highlight */
			let cell = tr.cells[0];
			let strong = cell.querySelector("strong");
			if (strong) { strong.parentNode.replaceChild(strong.firstChild, strong); }
		}
	}

	_focusAt(index) {
		index = Math.max(index, 0);
		index = Math.min(index, this._items.length-1);

		let oldIndex = this._getFocusedIndex();

		this._removeFocus();

		if (index > -1) { 
			let node = this._items[index].node;
			node.classList.add("focus");
			html.scrollIntoView(node, this._scroll);

			let plen = this._prefix.length;
			let name = this._items[index].path.getName();

			if (name && plen > 0) { /* highlight prefix */
				let nameL = name.toLowerCase();
				if (nameL.indexOf(this._prefix) == 0) {
					let cell = node.cells[0];
					let image = cell.querySelector("img");
					html.clear(cell);
					cell.appendChild(image);

					let strong = html.node("strong", {}, name.substring(0, plen));
					cell.appendChild(strong);
					cell.appendChild(html.text(name.substring(plen)));
				}
			}

			status.set(this._items[index].path.getDescription());
		}
	}

	_focusPath(path) {
		let focusIndex = this._items.reduce((result, item, index) => {
			return (path && item.path.is(path) ? index : result);
		}, 0);
		this._focusAt(focusIndex);
	}

	_search(ch) {
		let str = `${this._prefix}${ch}`;

		for (let i=0; i<this._items.length; i++) {
			let name = this._items[i].path.getName();
			if (!name) { continue; }
			if (name.toLowerCase().indexOf(str) == 0) { /* found! */
				this._prefix = str;
				this._focusAt(i);
				return;
			}
		}
		/* not found, nothing */
	}

	_clear() {
		this._items = [];
		this._table.innerHTML = "";
		this._prefix = "";
	}
}
