(function () {
'use strict';

class Path {
	getName() {}
	getPath() {}
	getChildren() {}
	follow() {}
	isDirectory() {}
	isSymbolicLink() {}
}

const fs = require("fs");
const path = require("path");

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
		this._path = p;
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	getName() {
		return path.basename(this._path);
	}

	isDirectory() { return this._meta.isDirectory; }
	isSymbolicLink() { return this._meta.isSymbolicLink; }

	follow() {
		return new this.constructor(this._target);
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

class List {
	constructor() {

	}

	setPath(path) {
		path.getChildren().then(paths => this._show(paths), FIXME);
	}

	_show(paths) {
		let table = document.createElement("table");
		paths.forEach(path => {
			let row = table.insertRow();
			row.insertCell().innerHTML = path.getName();
			row.insertCell().innerHTML = path.isDirectory();
			row.insertCell().innerHTML = path.isSymbolicLink() ? path.follow().getName() : "n/a";
		});
		document.body.appendChild(table);
	}
}

window.FIXME = (...args) => console.error(...args);

let list = new List();

let p = new Local("/tmp");
list.setPath(p);

}());
