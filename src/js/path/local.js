import Path, {CHILDREN, CREATE, EDIT} from "./path.js";
import * as format from "util/format.js";

const fs = require("fs");
const path = require("path");
const {app, shell} = require("electron").remote;

function statsToMetadata(stats) {
	return {
		isDirectory: stats.isDirectory(),
		isSymbolicLink: stats.isSymbolicLink(),
		date: stats.mtime,
		size: stats.size,
		mode: stats.mode
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
		}
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

function mkdir(path, mode) {
	return new Promise((resolve, reject) => {
		fs.mkdir(path, mode, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

function open(path, flags, mode) {
	return new Promise((resolve, reject) => {
		fs.open(path, flags, mode, (err, fd) => {
			if (err) { reject(err); } else { resolve(fd); }
		});
	});
}

function close(fd) {
	return new Promise((resolve, reject) => {
		fs.close(fd, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

export default class Local extends Path {
	static home() {
		return new this(app.getPath("home"));
	}

	constructor(p) {
		super();
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	getPath() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { return this._meta.isDirectory ? "folder.png" : "file.png"; }

	getDescription() {
		let d = this._path;
		/* fixme relativni */
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }
		if (!this._meta.isDirectory) {
			let size = this.getSize();
			/* fixme vynuceny vypnuty autoformat */
			if (size !== undefined) { d = `${d}, ${format.size(size)}`; }
		}
		return d;
	}
 
	getParent() {
		let parent = new this.constructor(path.dirname(this._path));
		return (parent.is(this) ? null : parent);
	}

	supports(what) { 
		switch (what) {
			case CHILDREN:
			case CREATE:
				return this._meta.isDirectory;
			break;

			case EDIT:
				return !this._meta.isDirectory;
			break;
		}
	}

	activate(list) {
		if (this.supports(CHILDREN)) {
			return super.activate(list);
		} else {
			shell.openItem(this._path);
		}
	}

	append(leaf) {
		let newPath = path.resolve(this._path, leaf);
		return new this.constructor(newPath);
	}

	create(opts = {}) {
		if (opts.dir) {
			return mkdir(this._path);
		} else {
			return open(this._path, "wx").then(close);
		}
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
			}

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
