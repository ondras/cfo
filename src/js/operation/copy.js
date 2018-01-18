import Progress from "progress/remote.js";
import Operation from "./operation.js";
import Scan from "./scan.js";
import {CHILDREN} from "path/path.js";

import LocalPath from "path/local.js";

// copy to the same parent -- create a " copy" suffix
async function createCopyOf(path) {
	let num = 0;
	let parent = path.getParent();
	let name = path.getName();

	while (true) {
		num++;
		let suffix = ` (copy${num > 1 ? " "+num : ""})`;

		let parts = name.split(".");
		let index = (parts.length > 1 ? parts.length-2 : parts.length-1);
		parts[index] += suffix;
		let newName = parts.join(".");

		let newPath = parent.append(newName);
		await newPath.stat();
		if (!newPath.exists()) { return newPath; }
	};
}

export default class Copy extends Operation {
	constructor(sourcePath, targetPath) {
		super();
		this._sourcePath = sourcePath;
		this._targetPath = targetPath;
		this._texts = {
			title: "Copying in progress",
			row1: "Copying:"
		}
		this._stats = {
			done: 0,
			total: 0
		}
	}

	async run() {
		let scan = new Scan(this._sourcePath);
		let root = await scan.run();
		if (!root) { return false; }

		this._stats.total = root.size;

		let options = {
			title: this._texts.title,
			row1: this._texts.row1,
			row2: "To:",
			progress1: "File:",
			progress2: "Total:"
		}
		this._progress = new Progress(options);
		this._progress.update({progress1:0, progress2:0});
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		let result = await this._copy(root, this._targetPath);

		this._end();
		return result;
	}

	/**
	 * @param {object} record Source record
	 * @param {Path} targetPath Target path
	 */
	async _copy(record, targetPath) {
		if (this._aborted) { return false; }

		await targetPath.stat();
		if (targetPath.exists()) { targetPath = await this._resolveExistingTarget(targetPath, record); }

		// does not exist => will be created during copy impl below

		if (record.children !== null) {
			return this._copyDirectory(record, targetPath);
		} else {
			return this._copyFile(record, targetPath);
		}
	}

	/**
	 * Copy a directory record to target directory path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyDirectory(record, targetPath) {
		let created = await this._createDirectory(targetPath, record.path.getMode());
		if (!created) { return false; }

		let okay = true;
		for (let child of record.children) {
			let childOkay = await this._copy(child, targetPath);
			if (!childOkay) { okay = false; }
		}

		let date = record.path.getDate();
		if (date) { await targetPath.setDate(date); }

		return okay;
	}

	/**
	 * @returns {Promise<bool>}
	 */
	async _createDirectory(path, mode) {
		if (path.exists() && path.supports(CHILDREN)) { return true; } // directory already exists, fine

		try {
			await path.create({dir:true, mode});
			return true;	
		} catch (e) {
			return this._handleCreateError(e, path, mode);
		}
	}

	/**
	 * Copy a file record to target file path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyFile(record, targetPath) {
		let progress1 = 0;
		let progress2 = 100*this._stats.done/this._stats.total;
		this._progress.update({row1:record.path.toString(), row2:targetPath.toString(), progress1, progress2});

		if (targetPath.exists()) { // target exists: overwrite/skip/abort
			let canOverwrite = await this._canOverwrite(record, targetPath);
			if (!canOverwrite)  { return false; }
		}

		if (record.path instanceof LocalPath && record.path.isSymbolicLink()) {
			return this._copyFileSymlink(record, targetPath);
			// no setDate here, fs.utimes adjusts target's mtime instead
		} else {
			let contentsOkay = await this._copyFileContents(record, targetPath);
			let date = record.path.getDate();
			await targetPath.setDate(date);
			return contentsOkay;
		}
	}

	async _copyFileSymlink(record, targetPath) {
		try {
			await targetPath.create({link:record.path.getTarget()});
			return true;
		} catch (e) {
			return this._handleSymlinkError(e, record, targetPath);
		}
	}

	async _copyFileContents(record, targetPath) {
		let done = 0;
		let opts = { mode:record.path.getMode() };
		let readStream = record.path.createStream("r");
		let writeStream = targetPath.createStream("w", opts);
		readStream.pipe(writeStream);

		return new Promise((resolve, reject) => {
			let handleError = async e => {
				try {
					let result = await this._handleCopyError(e, record, targetPath);
					resolve(result);
				} catch (e) {
					reject(e);
				}
			}
			readStream.on("error", handleError);
			writeStream.on("error", handleError);

			writeStream.on("finish", () => resolve(true));

			readStream.on("data", buffer => {
				done += buffer.length;
				this._stats.done += buffer.length;

				let progress1 = 100*done/record.size; 
				let progress2 = 100*this._stats.done/this._stats.total;
				this._progress.update({progress1, progress2});
			}); /* on data */
		}); /* file copy promise */		
	}

	async _canOverwrite(record, targetPath) {
		if (this._issues.overwrite == "overwrite-all") { return true; }

		if (this._issues.overwrite == "skip-all") { // silently skip
			this._stats.done += record.size;
			return false;
		}

		// no "-all" resolution
		let result = await this._handleFileExists(targetPath);
		switch (result) {
			case "abort":
				this.abort();
				return false;
			break;
			case "skip":
			case "skip-all":
				this._stats.done += record.size;
				return false;
			break;
			default: return true; break; // overwrite/overwrite-all
		}
	}

	async _handleFileExists(path) {
		let text = `Target file ${path} already exists`;
		let title = "File exists";
		let buttons = ["overwrite", "overwrite-all", "skip", "skip-all", "abort"];
		return this._processIssue("overwrite", { text, title, buttons });
	}

	async _handleCreateError(e, path, mode) {
		let text = e.message;
		let title = "Error creating directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("create", { text, title, buttons });

		switch (result) {
			case "retry": return this._createDirectory(path, mode); break;
			case "abort": this.abort(); break;
		}

		return false;
	}

	async _handleCopyError(e, record, targetPath) {
		let text = e.message;
		let title = "Error copying file";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("copy", { text, title, buttons });
		switch (result) {
			case "retry": return this._copyFile(record, targetPath); break;
			case "abort": this.abort(); break;
		}
		return false;
	}

	async _handleSymlinkError(e, record, targetPath) {
		let text = e.message;
		let title = "Error creating symbolic link";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("symlink", { text, title, buttons });
		switch (result) {
			case "retry": return this._copyFileSymlink(record, targetPath); break;
			case "abort": this.abort(); break;
		}
		return false;
	}

	async _resolveExistingTarget(targetPath, record) {
		// existing file
		if (!targetPath.supports(CHILDREN)) {
			if (targetPath.is(record.path)) { return createCopyOf(targetPath); }
			return targetPath;
		}

		// existing dir: needs two copyOf checks
		if (targetPath.is(record.path)) { return createCopyOf(targetPath); }
		targetPath = targetPath.append(record.path.getName());
		await targetPath.stat();
		if (targetPath.is(record.path)) { return createCopyOf(targetPath); }

		return targetPath;
	}
}
