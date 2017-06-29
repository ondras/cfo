// FIXME maintain timestamp, permissions
import Progress from "ui/progress.js";
import Operation from "./operation.js";
import Scan from "./scan.js";
import {CHILDREN} from "path/path.js";

export default class Copy extends Operation {
	constructor(sourcePath, targetPath) {
		super();
		this._sourcePath = sourcePath;
		this._targetPath = targetPath;
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
		await this._startCopying(root);
		this._end();
	}

	async _startCopying(root) {
		let options = {
			title: "Copying in progress",
			row1: "Copying:",
			row2: "To:",
			progress1: "File:",
			progress2: "Total:"
		}
		this._progress = new Progress(options);
		this._progress.update({progress1:0, progress2:0});
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._copy(root, this._targetPath);
	}

	/**
	 * @param {object} record Source record
	 * @param {Path} targetPath Target path without the appended part
	 */
	async _copy(record, targetPath) {
		if (this._aborted) { return; }

		await targetPath.stat();

		if (record.path.getParent().is(targetPath)) { /* copy to the same parent -- create a "copy of" prefix */
			let name = record.path.getName();
			while (targetPath.exists()) {
				name = `Copy of ${name}`;
				targetPath = record.path.getParent().append(name);
				await targetPath.stat();
			}
		} else if (targetPath.exists()) { /* append inside an existing target */
			targetPath = targetPath.append(record.path.getName());
		} /* else does not exist, will be created during copy impl below */

		/* FIXME symlinks */

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
		let created = await this._createDirectory(targetPath);
		if (!created) { return; }

		for (let child of record.children) {
			await this._copy(child, targetPath);
		}
	}

	/**
	 * @returns {Promise<bool>}
	 */
	async _createDirectory(path) {
		if (path.exists() && path.supports(CHILDREN)) { return true; } /* folder already exists, fine */

		try {
			await path.create({dir:true});
			return true;	
		} catch (e) {
			return this._handleCreateError(e, path);
		}
	}

	/**
	 * Copy a filter record to target file path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyFile(record, targetPath) {
		let done = 0;
		let progress1 = 0;
		let progress2 = 100*this._stats.done/this._stats.total;
		this._progress.update({row1:record.path.getPath(), row2:targetPath.getPath(), progress1, progress2});

		if (targetPath.exists()) { /* target exists: overwrite/skip/abort */
			if (this._issues.overwrite == "skip-all") { /* silently skip */
				this._stats.done += record.size;
				return;
			}
			if (this._issues.overwrite != "overwrite-all") { /* raise an issue */
				let result = await this._handleFileExists(targetPath);
				switch (result) {
					case "abort": this.abort(); return; break;
					case "skip":
					case "skip-all":
						this._stats.done += record.size;
						return;
					break;
					/* overwrite = continue */
				}
			}
		}

		let readStream = record.path.createStream("r");
		let writeStream = targetPath.createStream("w");
		readStream.pipe(writeStream);

		return new Promise(resolve => {
			let handleError = async e => {
				await this._handleCopyError(e, record, targetPath);
				resolve();
			}

			writeStream.on("finish", resolve);
			readStream.on("error", handleError);
			writeStream.on("error", handleError);

			readStream.on("data", buffer => {
				done += buffer.length;
				this._stats.done += buffer.length;

				let progress1 = 100*done/record.size; 
				let progress2 = 100*this._stats.done/this._stats.total;
				this._progress.update({progress1, progress2});
			}); /* on data */
		}); /* file copy promise */
	}

	async _handleFileExists(path) {
		let text = `Target file ${path.getPath()} already exists`;
		let title = "File exists";
		let buttons = ["overwrite", "overwrite-all", "skip", "skip-all", "abort"];
		return this._processIssue("overwrite", { text, title, buttons });
	}

	async _handleCreateError(e, path) {
		let text = e.message;
		let title = "Error creating directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("create", { text, title, buttons });

		switch (result) {
			case "retry": return this._createDirectory(path); break;
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
	}
}
/*
// Try to copy symlink
Operation.Copy.prototype._copySymlink = function(oldPath, newPath) {
	// try to locate "ln" 
	var fn = null;
	var path = "/bin/ln";
	var func = function() { 
		ln = Path.Local.fromString(path); 
		if (!ln.exists()) { throw Cr.NS_ERROR_FILE_NOT_FOUND; }
	};
	var found = this._repeatedAttempt(func, path, "ln");
	if (this._state == Operation.ABORTED || !found) { return; }
	
	if (newPath.exists()) { // existing must be removed
		var func = function() { newPath.delete(); }
		var deleted = this._repeatedAttempt(func, newPath, "create");
		if (this._state == Operation.ABORTED || !deleted) { return; }
	}
	
	// run it as a process
	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(ln.getFile());
	var params = ["-s", oldPath.getPath(), newPath.getPath()];
	
	var func = function() { 
		process.run(false, params, params.length);
		var cnt = 0; 
		while (process.isRunning) { // wait for exitValue
			cnt++;
			if (cnt > 100000) { break; } // no infinite loops 
		}
		if (process.exitValue) { throw Cr.NS_ERROR_FILE_ACCESS_DENIED; }
	}
	this._repeatedAttempt(func, newPath.getPath(), "create");

	// if we succeeded, if we did not - this one is done 
	this._scheduleNext(); 
}

*/