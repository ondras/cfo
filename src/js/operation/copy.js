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
		this._record = null;
	}

	run() {
		return new Scan(this._sourcePath).run().then(root => {
			if (!root) { return Promise.resolve(false); }
			return this._startCopying(root);
		});
	}

	_startCopying(root) {
		let options = {
			title: "Copying…",
			row1: "Total:",
			progress1: " "

		}
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._copy(root, this._targetPath);
	}

	/**
	 * @param {object} record Source record
	 * @param {Path} targetPath Target path without the appended part
	 */
	_copy(record, targetPath) {
		console.log("copying", record.path, "to", targetPath);
		if (this._aborted) { return Promise.resolve(false); }

		// show where are we FIXME stats etc
		var path = record.path;
		this._progress.update({row1:path.getPath()});

		/* create new proper target name */
		targetPath = targetPath.append(record.path.getName());

		/* FIXME symlinks */

		if (record.children !== null) {
			return this._copyDirectory(record, targetPath);
		} else {
			return this._copyFile(record, targetPath);
		}
	}

	// Create a new (non-existant) target path for currently processed source node
	_createCurrentTarget(record) {
		// copy to the same file/dir: create a "copy of" clone 
		// FIXME exists
		/*
		if (currentTarget.is(record.path)) {
			var name = newPath.getName();
			var parent = newPath.getParent();
			while (newPath.exists()) { 
				name = "Copy of " + name;
				newPath = parent.append(name);
			}
			record.targetName = name; // remember as a "renamed" target name for potential children
		}
*/
		return currentTarget;
	}

	/**
	 * Copy a directory record to target directory path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	_copyDirectory(record, targetPath) {
		return this._createDirectory(targetPath).then(created => {
			if (!created) { return false; }
			return this._copyChild(record, targetPath); // recurse to first child
		});
	}

	_copyChild(record, targetPath) {
		if (record.children.length == 0) { return true; }

		return this._copy(record.children[0], targetPath).then(copied => {
			record.children.shift();
			return this._copyChild(record, targetPath); // recurse to other children
		});
	}

	_createDirectory(path) {
		let createImpl = () => {
			return path.create({dir:true}).then(
				() => true,
				e => this._handleCreateError(e, path)
			);
		}

		return path.stat().then(
			() => { /* exists! */
				if (path.supports(CHILDREN)) { return true; } /* folder already exists, fine */
				return createImpl(); /* already exists as a file, will throw an exception */
			},
			createImpl /* does not exist, good */
		);
	}

	/**
	 * Copy a filter record to target file path
	 * @param {object} record
	 * @param {Path} targetPath already appended target path
	 */
	_copyFile(record, targetPath) {
		/* FIXME exists */

		let readStream = record.path.createStream("r");
		let writeStream = targetPath.createStream("w");
		readStream.pipe(writeStream);

		return new Promise(resolve => {
			let handleError = e => {
				return this._handleCopyError(e, record, targetPath).then(resolve);
			}

			writeStream.on("finish", () => resolve(true));
			readStream.on("error", handleError);
			writeStream.on("error", handleError);

			readStream.on("data", buffer => console.log(buffer.length));
		});
	}

	_handleCreateError(e, path) {
		let text = e.message;
		let title = "Error creating directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let config = { text, title, buttons };
		return this._processIssue("create", config).then(result => {
			switch (result) {
				case "retry": return this._createDirectory(path); break;
				case "abort": this.abort(); return false; break;
				default: return false; break;
			}
		});
	}

	_handleCopyError(e, record, targetPath) {
		let text = e.message;
		let title = "Error copying file";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let config = { text, title, buttons };
		return this._processIssue("copy", config).then(result => {
			switch (result) {
				case "retry": return this._copyFile(record, targetPath); break;
				case "abort": this.abort(); return false; break;
				default: return false; break;
			}
		});
	}

}

/*
	
	this._count.total = root.count;
	this._currentNode = root;
	
	this._run();
}
*/


/*

Operation.Copy.prototype._showProgress = function() {
	var data = {
		"title": _(this._prefix + ".title"),
		"row1-label": _(this._prefix + ".working"),
		"row2-label": _(this._prefix + ".to"),
		"progress1-label": _("progress.total"),
		"progress2-label": _("progress.file"),
	};
	Operation.prototype._showProgress.call(this, data);
}

Operation.Copy.prototype._iterate = function() {
	if (this._current.is) {
		var bufferSize = 0x100000;
		var amount = Math.min(this._current.is.available(), bufferSize);

		var bytes = this._current.is.readByteArray(amount);
		this._current.os.writeByteArray(bytes, bytes.length);
		
		this._current.bytesDone += amount;
		this._count.done += amount;
		
		var data = {
			"progress1": 100 * this._count.done / this._count.total,
			"progress2": 100 * this._current.bytesDone / this._current.size
		}
		this._updateProgress(data);
		
		if (!this._current.is.available()) {
			this._current.is.close();
			this._current.os.close();
			this._current.is = null;
			this._current.os = null;
			this._scheduleNext();
		}
		
		return;
	}
	// target path for this copy operation 
	var newPath = this._newPath(this._node);
	
	// update progress window
	var data = {
		"row1-value": this._node.path.getPath(),
		"row2-value": newPath.getPath(),
		"progress2": 0
	}
	this._updateProgress(data);
	
	// source = dir? 
	var dir = this._node.path.supports(FC.CHILDREN);

	// create target path
	var created = this._createPath(newPath, dir, this._node.path.getTS());
	if (this._state == Operation.ABORTED) { return; }

	if (created) {
		if (dir) { // schedule next child
			this._scheduleNext(); 
		} else if (!this._node.path.isSymlink()) { // start copying contents
			this._copyContents(this._node.path, newPath);
		} else { // symlink, evil
			this._copySymlink(this._node.path, newPath);
		}
	} else { // skipped
		this._count.done += this._node.bytes;
		this._scheduleNext();
	}
	
	this._updateProgress({"progress1": this._count.done / this._count.total * 100});
}



// @returns {bool} whether the path was created
Operation.Copy.prototype._createPath = function(newPath, directory, ts) {
	if (!directory && newPath.exists()) { // it is a file and it already exists
		if (this._issues.overwrite == "skip") { return false; } // silently skip
		if (this._issues.overwrite == "all") { return true; } // we do not care

		var text = _("error.exists", newPath.getPath());
		var title = _("error");
		var buttons = [Operation.OVERWRITE, Operation.OVERWRITE_ALL, Operation.SKIP, Operation.SKIP_ALL, Operation.ABORT];
		var result = this._showIssue(text, title, buttons);
		
		switch (result) {
			case Operation.OVERWRITE:
			break;
			case Operation.OVERWRITE_ALL:
				this._issues.overwrite = "all";
			break;
			case Operation.SKIP:
				return false;
			break;
			case Operation.SKIP_ALL:
				this._issues.overwrite = "skip";
				return false;
			break;
			case Operation.ABORT:
				this._state = Operation.ABORTED;
				return false;
			break;
		}
	}

	if (!directory || newPath.exists()) { return true; } // nothing to do with file or existing directory
	
	var func = function() { 
		newPath.create(true); 
		newPath.setTS(ts);
	}
	return this._repeatedAttempt(func, newPath.getPath(), "create");
}

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