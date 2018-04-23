import Scan from "operation/scan.js";
import QuickEdit from "ui/quickedit.js";

import Up from "path/up.js";
import {CHILDREN} from "path/path.js";
import prompt from "ui/prompt.js";

import * as paths from "path/paths.js";
import * as html from "util/html.js";
import * as format from "util/format.js";
import * as pubsub from "util/pubsub.js";
import * as status from "status.js";

const TEMPLATE = document.querySelector("#list");

function SORT(a, b) {
	let childScoreA = a.getSort();
	let childScoreB = b.getSort();
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
		this._selected = new Set();

		pubsub.subscribe("path-change", this);
	}

	destroy() {
		pubsub.unsubscribe("path-change", this);
	}

	getNode() { return this._node; }
	getPath() { return this._path; }

	clearSelection() {
		this._selected.clear();
		this._syncSelected();
	}

	reload(pathToBeFocused) {
		this._pathToBeFocused = pathToBeFocused;
		this._loadPathContents(this._path);
	}

	async setPath(path) {
		this._pathToBeFocused = this._path; // will try to focus it afterwards
		await path.stat();
		let loaded = await this._loadPathContents(path);
		if (loaded) {
			pubsub.publish("list-change", this);
			this._updateTitle();
		}
		return loaded;
	}

	focusInput() {
		this._input.focus();
		this._input.selectionStart = 0;
		this._input.selectionEnd = this._input.value.length;
	}

	getSelection(options = {}) {
		if (!options.multi || this._selected.size == 0) {
			let index = this._getFocusedIndex();
			if (index == -1) { return null; }
			return this._items[index].path;
		} else {
			let items = [];
			this._selected.forEach(index => items.push(this._items[index].path));
			return paths.group(items);
		}
	}

	activate() {
		if (this._active) { return; }

		this._node.classList.add("active");
		this._active = true;
		document.addEventListener("keydown", this);

		this._focusPath(this._pathToBeFocused, 0);
		this._pathToBeFocused = null;

		this._updateTitle();
	}

	deactivate() {
		if (!this._active) { return; }

		this._active = false;
		document.removeEventListener("keydown", this);
		this._node.classList.remove("active");

		this._quickEdit.stop();
		this._prefix = "";

		this._pathToBeFocused = this.getSelection({multi:false});
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

		await newPath.stat();
		if (newPath.exists()) {
			let result = await confirm(`Target path "${path}" already exists. Overwrite?`);
			if (!result) { return; }
		}

		try {
			await path.rename(newPath);
			this.reload(newPath);
		} catch (e) {
			alert(e.message);
		}
	}

	handleMessage(message, publisher, data) {
		switch (message) {
			case "path-change":
				if (data.path.is(this._path)) { this.reload(); }
			break;
		}
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
					return;
				}

				if (e.ctrlKey) { // ctrl+a = vyber vseho
					if (e.key == "a") { 
						e.preventDefault();
						this._selectAll();
					}
				} else { // nechceme aby ctrl+l hledalo od "l"
					e.preventDefault();
					this._handleKey(e.key);
				}
			break;
		}
	}

	_handleInputKey(key) {
		switch (key) {
			case "Enter":
				this._input.blur();
				let path = paths.fromString(this._input.value);
				this.setPath(path);
			break;

			case "Escape":
				this._input.blur();
			break;
		}
	}

	async _handleKey(key) {
		let index = this._getFocusedIndex();
		let item;

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

			case "Insert":
				if (index == -1) { return; }
				this._selectToggle(index);
				this._focusBy(+1);
			break;

			case " ":
				if (index == -1) { return; }
				this._selectToggle(index);

				item = this._items[index];
				let scan = new Scan(item.path);
				let result = await scan.run();
				if (!result) { return; }
				item.size = result.size;

				html.clear(item.node);
				this._buildRow(item);

				this._prefix = "";
				this._focusBy(+1);
			break;

			case "Escape":
				this._prefix = "";
				if (index > -1) { this._focusAt(index); } /* redraw without prefix highlight */
			break;

			case "+": this._addSelected(); break;
			case "-": this._removeSelected(); break;
			case "*": this._invertSelected(); break;

			default:
				if (key.length == 1) { this._search(key.toLowerCase()); }
			break;
		}
	}

	async _loadPathContents(path) {
		try {
			let paths = await path.getChildren();
			this._path = path;
			this._show(paths);
			return true;
		} catch (e) {
			// "{"errno":-13,"code":"EACCES","syscall":"scandir","path":"/tmp/aptitude-root.4016:Xf20YI"}"
			alert(e.message);
			return false;
		}
	}

	_activatePath() {
		let path = this.getSelection({multi:false});
		if (!path) { return; }
		path.activate(this);
	}

	_show(paths) {
		let fallbackIndex = (this._pathToBeFocused ? 0 : this._getFocusedIndex());

		this._clear();
		this._selected.clear();

		this._input.value = this._path;
		paths.sort(SORT);

		let parent = this._path.getParent();
		if (parent) {
			let up = new Up(parent);
			paths.unshift(up);
		}

		if (!paths.length) { return; }

		this._items = this._build(paths);

		if (this._active) {
			this._focusPath(this._pathToBeFocused, fallbackIndex);
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
		let img = path.getImage();
		td.appendChild(img);

		let name = path.getName();
		if (name) { td.appendChild(html.text(name)); }

		let size = path.getSize();
		if (size === undefined) { size = item.size; } /* computed value (for directories) */
		node.insertCell().innerHTML = (size === undefined ? "" : format.size(size, {auto:true}));

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
		return this._items.reduce((result, item, index) => (item.node == focused ? index : result), -1);
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
					let image = cell.querySelector("img, canvas");
					html.clear(cell);
					cell.appendChild(image);

					let strong = html.node("strong", {}, name.substring(0, plen));
					cell.appendChild(strong);
					cell.appendChild(html.text(name.substring(plen)));
				}
			}

			this._updateStatus();
		}
	}

	/* Focus a given path. If not available, focus a given index. */
	_focusPath(path, fallbackIndex) {
		let focusIndex = this._items.reduce((result, item, index) => {
			return (path && item.path.is(path) ? index : result);
		}, fallbackIndex);
		this._focusAt(focusIndex);
	}

	_updateStatus() {
		let index = this._getFocusedIndex();
		let str = this._items[index].path.getDescription();

		let selected = Object.keys(this._selected);
		if (this._selected.size > 0) {
			let fileCount = 0;
			let dirCount = 0;
			let bytes = 0;
			this._selected.forEach(index => { fixme
				let item = this._items[index];

				if (item.path.supports(CHILDREN)) {
					dirCount++;
				} else {
					fileCount++;
				}
				
				if ("size" in item) {
					bytes += item.size;
				} else {
					bytes += item.path.getSize() || 0;
				}
			});
			
			str = `Selected ${format.size(bytes, {auto:false})} bytes in ${fileCount} files and ${dirCount} directories`;
		}

		status.set(str);
	}

	_updateTitle() {
		let path = this._path;
		if (!path) { return; }
		document.title = `${path.toString()} – CFO`;
	}


	_search(ch) {
		let str = `${this._prefix}${ch}`;

		let startIndex = this._getFocusedIndex();
		if (startIndex == -1) { startIndex = 0; }

		// start at the currently focused index
		let items = this._items.slice(startIndex);
		if (startIndex > 0) { items = items.concat(this._items.slice(0, startIndex)); }

		for (let i=0; i<items.length; i++) {
			let name = items[i].path.getName();
			if (!name) { continue; }
			if (name.toLowerCase().indexOf(str) == 0) { /* found! */
				this._prefix = str;
				this._focusAt((i + startIndex) % items.length);
				return;
			}
		}
		/* not found, nothing */
	}

	_syncSelected() {
		this._items.forEach((item, index) => {
			item.node.classList.toggle("selected", this._selected.has(index));
		});
		this._updateStatus();
	}

	_clear() {
		this._items = [];
		this._table.innerHTML = "";
		this._prefix = "";
	}

	_invertSelected() {
		let newSelected = new Set();

		this._selected.forEach(index => { // copy already selected directories
			if (this._items[index].path.supports(CHILDREN)) { newSelected[index] = true; }
		})

		this._items.forEach((item, index) => {
			if (this._selected.has(index)) { return; } // already selected
			if (item.path.supports(CHILDREN)) { return; } // do not select directories
			if (item.path instanceof Up) { return; } // do not select "..""
			newSelected.add(index);
		});

		this._selected = newSelected;
		this._syncSelected();
	}

	async _addSelected() {
		let pattern = await this._getPattern("Select all files matching this pattern:");
		if (!pattern) { return; }
		
		this._items.forEach((item, index) => {
			if (this._selected.has(index)) { return; } // already selected
			if (item.path.supports(CHILDREN)) { return; } // do not select directories
			if (item.path.getName().match(pattern)) { this._selected.add(index); } // name match
		});

		this._syncSelected();
	}

	async _removeSelected() {
		let pattern = await this._getPattern("Deselect all files matching this pattern:");
		if (!pattern) { return; }

		this._selected.forEach(index => {
			let path = this._items[index].path;
			if (path.getName().match(pattern)) { this._selected.delete(index); } // name match
		});

		this._syncSelected();
	}

	async _getPattern(text) {
		let result = await prompt(text, "*");
		if (!result) { return; }

		result = result.replace(/\./g, "\\.");
		result = result.replace(/\*/g, ".*");
		result = result.replace(/\?/g, ".");

		return new RegExp(`^${result}$`);
	}

	_selectAll() {
		this._selected.clear();
		this._items.forEach((item, index) => {
			if (item.path instanceof Up) { return; }
			this._selected.add(index);
		});
		this._syncSelected();
	}

	_selectToggle(index) {
		if (this._items[index].path instanceof Up) { return; }
		if (this._selected.has(index)) {
			this._selected.delete(index);
		} else {
			this._selected.add(index);
		}
		this._syncSelected();
	}
}
