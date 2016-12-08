(function () {
'use strict';

class Path {
	is(other) { return other.getPath() == this.getPath(); }
	getName() {}
	getPath() {}
	getParent() {}
	getChildren() {}
	supports(what) {}
	activate() {}
}

const CHILDREN = 0;

const fs = require("fs");
const path = require("path");
const {shell} = require("electron");

function statsToMetadata(stats) {
	return {
		isDirectory: stats.isDirectory(),
		isSymbolicLink: stats.isSymbolicLink()
	}
}

function getMetadata(path, link) {
	return new Promise((resolve, reject) => {
		let cb = (err, stats) => {
			if (err) { 
				reject(err);
			} else {
				resolve(statsToMetadata(stats));
			}
		};
		link ? fs.lstat(path, cb) : fs.stat(path, cb);
	})
}

function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs.readlink(linkPath, (err, targetPath) => {
			if (err) { reject(err); } else {
				let linkDir = path.dirname(linkPath);
				let finalPath = path.resolve(linkDir, targetPath);
				resolve(finalPath);
			}
		});
	});
}

function readdir(path) {
	return new Promise((resolve, reject) => {
		fs.readdir(path, (err, files) => {
			if (err) { reject(err); } else { resolve(files); }
		});
	});
}

class Local extends Path {
	constructor(p) {
		super();
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	getPath() {
		return this._path;
	}

	getName() {
		return path.basename(this._path);
	}

	getParent() {
		let parent = new this.constructor(path.dirname(this._path));
		return (parent.is(this) ? null : parent);
	}

	supports(what) { 
		switch (what) {
			case CHILDREN: return this._meta.isDirectory; break;
		}
	}

	activate() {
		shell.openItem(this._path);
	}

	getChildren() {
		return readdir(this._path).then(names => {
			let paths = names
				.map(name => path.resolve(this._path, name))
				.map(name => new this.constructor(name));

			// safe stat: always fulfills with the path
			let stat = p => { 
				let id = () => p;
				return p.stat().then(id, id);
			};

			let promises = paths.map(stat);
			return Promise.all(promises);
		});
	}

	stat() {
		return getMetadata(this._path, true).then(meta => {
			Object.assign(this._meta, meta);
			if (!meta.isSymbolicLink) { return; }

			/* symlink: get target path (readlink), get target metadata (stat), merge directory flag */

			return readlink(this._path).then(targetPath => {
				this._target = targetPath;

				/* we need to get target isDirectory flag */
				return getMetadata(this._target, false).then(meta => {
					this._meta.isDirectory = meta.isDirectory;
				}, e => { /* failed to stat link target */
					delete this._meta.isDirectory;
				});

			}, e => { /* failed to readlink */
				this._target = e;
			});
		});
	}
}

/* fixme tezko rict, jestli cestu takto maskovat, kdyz o patro vys lze jit i klavesovou zkratkou... */
class Up extends Path {
	constructor(path) {
		super();
		this._path = path;
	}

	getName() { return ".."; }

	getPath() {
		return this._path.getPath();
	}

	getChildren() {
		return this._path.getChildren();
	}

	getParent() {
		return this._path.getParent();
	}

	supports(what) {
		return (what == CHILDREN);
	}
}

function SORT(a, b) {
	let childScoreA = (a.supports(CHILDREN) ? 1 : 2);
	let childScoreB = (b.supports(CHILDREN) ? 1 : 2);
	if (childScoreA != childScoreB) { return childScoreA - childScoreB; }

	return a.getName().fileLocaleCompare(b.getName());
}

class List {
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

window.FIXME = (...args) => console.error(...args);

String.prototype.fileLocaleCompare = function(other) {
	for (var i=0;i<Math.max(this.length, other.length);i++) {
		if (i >= this.length) { return -1; } /* this shorter */
		if (i >= other.length) { return  1; } /* other shorter */
		
		let ch1 = this.charAt(i);
		let ch2 = other.charAt(i);
		let c1 = ch1.charCodeAt(0);
		let c2 = ch2.charCodeAt(0);
		
		let special1 = (c1 < 128 && !ch1.match(/a-z/i)); /* non-letter char in this */
		let special2 = (c2 < 128 && !ch2.match(/a-z/i)); /* non-letter char in other */
		
		if (special1 != special2) { return (special1 ? -1 : 1); } /* one has special, second does not */
		
		let r = ch1.localeCompare(ch2); /* locale compare these two normal letters */
		if (r) { return r; }
	}

	return 0; /* same length, same normal/special positions, same localeCompared normal chars */
};

let list = new List();

let p = new Local("/home/ondras/");
list.setPath(p);

}());
