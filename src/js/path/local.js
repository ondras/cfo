import Path, {CHILDREN, CREATE, EDIT, RENAME, DELETE } from "./path.js";
import {readlink, readdir, mkdir, open, close, rename, unlink, rmdir, utimes, symlink} from "util/fs.js";
import * as format from "util/format.js";

const fs = require("fs");
const path = require("path");
const {shell} = require("electron").remote;

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
		this._path = path.resolve(p); /* to get rid of a trailing slash */
		this._target = null;
		this._error = null;
		this._meta = {};
	}

	toString() { return this._path; }
	getName() { return path.basename(this._path) || "/"; }
	getDate() { return this._meta.date; }
	getSize() { return (this._meta.isDirectory ? undefined : this._meta.size); }
	getMode() { return this._meta.mode; }
	getImage() { return this._meta.isDirectory ? "folder.png" : "file.png"; }
	exists() { return ("isDirectory" in this._meta); }

	/* symlink-specific */
	isSymbolicLink() { return this._meta.isSymbolicLink; }
	getTarget() { return this._target; }

	getDescription() {
		let d = this._path;
		/* fixme relativni */
		if (this._meta.isSymbolicLink) { d = `${d} → ${this._target}`; }

		if (!this._meta.isDirectory) {
			let size = this.getSize();
			/* fixme vynuceny vypnuty autoformat */
			if (size !== undefined) { d = `${d}, ${format.size(size)} bytes`; }
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

			case RENAME:
			case DELETE:
				return true;
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

		/* symlink: get target path (readlink), get target metadata (stat), merge directory flag */
		try {
			let targetPath = await readlink(this._path); // fixme readlink prevede na absolutni, to je spatne
			this._target = targetPath;

			/*
			 FIXME: k symlinkum na adresare povetsinou neni duvod chovat se jako k adresarum (nechceme je dereferencovat pri listovani/kopirovani...).
			 Jedina vyjimka je ikonka, ktera si zaslouzi vlastni handling, jednoho dne.
			 */
			return;

			/* we need to get target isDirectory flag */
			return getMetadata(this._target, {link:false}).then(meta => {
				this._meta.isDirectory = meta.isDirectory;
			}, e => { /* failed to stat link target */
				delete this._meta.isDirectory;
			});

		} catch (e) { /* failed to readlink */
			this._target = e;
		}
	}
}
