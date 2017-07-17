import Progress from "progress/remote.js";
import Operation from "./operation.js";
import Scan from "./scan.js";
import {CHILDREN} from "path/path.js";

import LocalPath from "path/local.js";

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
		await this._startCopying(root);
		this._end();
	}

	async _startCopying(root) {
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

		return this._copy(root, this._targetPath);
	}

	/**
	 * @param {object} record Source record
	 * @param {Path} targetPath Target path without the appended part
	 */
	async _copy(record, targetPath) {
		if (this._aborted) { return; }

		await targetPath.stat();

		if (targetPath.exists()) { /* append inside an existing target */
			targetPath = targetPath.append(record.path.getName());
			await targetPath.stat();

			if (targetPath.is(record.path)) { /* copy to the same parent -- create a "copy of" prefix */
				while (targetPath.exists()) { 
					let name = `Copy of ${targetPath.getName()}`;
					targetPath = targetPath.getParent().append(name);
					await targetPath.stat();
				}
			} /* not the same parent */

		} /* else does not exist, will be created during copy impl below */

		if (record.children !== null) {
			await this._copyDirectory(record, targetPath);
		} else {
			await this._copyFile(record, targetPath);
		}

		let date = record.path.getDate();
		if (date) { await targetPath.setDate(date); }

		return this._recordCopied(record);
	}

	/**
	 * Copy a directory record to target directory path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	async _copyDirectory(record, targetPath) {
		let created = await this._createDirectory(targetPath, record.path.getMode());
		if (!created) { return; }

		for (let child of record.children) {
			await this._copy(child, targetPath);
		}
	}

	/**
	 * @returns {Promise<bool>}
	 */
	async _createDirectory(path, mode) {
		if (path.exists() && path.supports(CHILDREN)) { return true; } /* folder already exists, fine */

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

		if (record.path instanceof LocalPath && record.path.isSymbolicLink()) {
			return this._copyFileSymlink(record, targetPath);
		} else {
			return this._copyFileContents(record, targetPath);
		}
	}

	async _copyFileSymlink(record, targetPath) {
		try {
			await targetPath.create({link:record.path.getTarget()});
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

		await new Promise(resolve => {
			let handleError = async e => {
				await this._handleCopyError(e, record, targetPath);
				resolve();
			}
			readStream.on("error", handleError);
			writeStream.on("error", handleError);

			writeStream.on("finish", resolve);

			readStream.on("data", buffer => {
				done += buffer.length;
				this._stats.done += buffer.length;

				let progress1 = 100*done/record.size; 
				let progress2 = 100*this._stats.done/this._stats.total;
				this._progress.update({progress1, progress2});
			}); /* on data */
		}); /* file copy promise */		
	}

	async _recordCopied(record) {} /* used only for moving */

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
	}
}
