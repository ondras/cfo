import Path, {CHILDREN, CREATE, READ, WRITE} from "./path.js";
import {readlink, readdir, mkdir, open, close, rename, unlink, rmdir, utimes, symlink} from "util/fs.js";
import * as format from "util/format.js";
import * as icons from "util/icons.js";
import * as mime from "util/mime.js";

const fs = require("fs");
const path = require("path");
const remote = require("electron").remote;

function statsToMetadata(stats) {
	return {
		isDirectory: stats.isDirectory(),
		isSymbolicLink: stats.isSymbolicLink(),
		date: stats.mtime,
		size: stats.size,
		mode: stats.mode
	}
}

function getMetadata(path, options = {}) {
	return new Promise((resolve, reject) => {
		let cb = (err, stats) => {
			if (err) { 
				reject(err);
			} else {
				resolve(statsToMetadata(stats));
			}
		}
		options.link ? fs.lstat(path, cb) : fs.stat(path, cb);
	});
}

export default class Local extends Path {
	static match(str) { return str.match(/^\//); }

	constructor(p) {
		super();
		this._path = path.resolve(p); // to get rid of a trailing slash
		this._target = null; // string, relative or absolute; null when failed to readlink
		this._targetPath = null; // Local, absolute, for icon resolution, might not exist
		this._error = null;
		this._meta = {};
	}

	toString() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() {
		let mimeType = mime.getType(this.toString()) || "file"; 

		let link = this._meta.isSymbolicLink;
		let name = mimeType; // regular file

		if (link) {
			if (!this._targetPath || !this._targetPath.exists()) { // unreadable/broken symlink
				name = "broken";
			} else if (this._targetPath.supports(CHILDREN)) { // symlink to existing directory
				name = "folder";
			}
		} else if (this.supports(CHILDREN)) { // regular directory
			name = "folder";
		}

		return icons.create(name, {link});
	}
	exists() { return ("isDirectory" in this._meta); }

	getSort() {
		if (this._meta.isSymbolicLink && this._targetPath) {
			return this._targetPath.getSort();
		} else {
			return super.getSort();
		}
	}

	/* symlink-specific */
	isSymbolicLink() { return this._meta.isSymbolicLink; }
	getTarget() { return this._target; }

	getDescription() {
		let d = this._path;
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }

		if (!this._meta.isDirectory) {
			let size = this.getSize();
			/* force raw bytes, no auto units */
			if (size !== undefined) { d = `${d}, ${format.size(size, {auto:false})} bytes`; }
		}
		return d;
	}
 
	getParent() {
		let parent = new this.constructor(path.dirname(this._path));
		return (parent.is(this) ? null : parent);
	}

	supports(what) { 
		switch (what) {
			case CHILDREN: // FIXME symlink je spis soubor nez adresar, co kdyby zde vracel false? nemusela by na nej byt vyjimka v operation.scan
			case CREATE:
				if (this._meta.isDirectory) { return true; }
				if (this._meta.isSymbolicLink) {
					return (this._targetPath && this._targetPath.supports(what));
				} else {
					return false;
				}
			break;

			case READ:
			case WRITE:
				return true;
			break;
		}
	}

	activate(list) {
		if (this.supports(CHILDREN)) {
			return super.activate(list);
		} else {
			remote.shell.openItem(this._path);
		}
	}

	append(leaf) {
		let newPath = path.resolve(this._path, leaf);
		return new this.constructor(newPath);
	}

	async create(opts = {}) {
		if (opts.link) {
			return symlink(opts.link, this._path);
		} else if (opts.dir) {
			return mkdir(this._path);
		} else {
			let handle = await open(this._path, "wx", opts.mode);
			return close(handle);
		}
	}

	async rename(newPath) {
		return rename(this._path, newPath.toString());
	}

	async delete() {
		return (this._meta.isDirectory ? rmdir(this._path) : unlink(this._path));
	}

	async setDate(date) {
		let ts = date.getTime()/1000;
		return utimes(this._path, ts, ts);
	}

	async getChildren() {
		let names = await readdir(this._path);
		let paths = names
			.map(name => path.resolve(this._path, name))
			.map(name => new this.constructor(name));

		let promises = paths.map(path => path.stat());
		await Promise.all(promises);

		return paths;
	}

	createStream(type, opts) {
		switch (type) {
			case "r": return fs.createReadStream(this._path, opts); break;
			case "w": return fs.createWriteStream(this._path, opts); break;
			default: throw new Error(`Unknown stream type "${type}"`); break;
		}
	}

	async stat() {
		try {
			this._meta = await getMetadata(this._path, {link:true});
		} catch (e) {
			this._meta = {};
		}

		if (!this._meta.isSymbolicLink) { return; }

		// symlink: get target path (readlink), get target metadata (stat)
		try {
			let target = await readlink(this._path);
			this._target = target;

			// resolve relative path
			let linkDir = path.dirname(this._path);
			target = path.resolve(linkDir, target);

			let targetPath = new Local(target);
			this._targetPath = targetPath;

			await targetPath.stat();

		} catch (e) {} // failed to readlink
	}
}
