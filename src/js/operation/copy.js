/*

Operation.Copy = function(sourcePath, targetPath) {
	Operation.call(this);
	
	this._sourcePath = sourcePath;
	this._targetPath = targetPath;
	this._prefix = "copy";
	
	this._init();
}

Operation.Copy.prototype = Object.create(Operation.prototype);

Operation.Copy.prototype.run = function() {
	new Operation.Scan(this._sourcePath).run().then(this._scanDone.bind(this));
	return this._promise;	
}

Operation.Copy.prototype._init = function() {
	this._issues.read = false;
	this._issues.write = false;
	this._issues.create = false;
	this._issues.overwrite = false;
	this._issues.ln = false;
	
	this._current = {
		is: null,
		os: null,
		bytesDone: 0,
		size: 0
	};

	this._count = {
		total: 0,
		done: 0
	}
} 

Operation.Copy.prototype._scanDone = function(root) {
	if (!root) { return; } // FIXME urcite? co nejaky callback? 
	this._count.total = root.size;
	
	this._node = root;
	
	this._run();
}

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

// Create a new (non-existant) target path for currently processed source node
Operation.Copy.prototype._newPath = function(node) {
	// one-to-one copy with new name
	if (!this._targetPath.exists() && this._targetPath instanceof Path.Local) { return this._targetPath; }
	
	var names = [];
	var current = node;
	while (current) {
		names.unshift(current.targetName || current.path.getName()); // pick either renamed target name, or current leaf name 
		current = current.parent;
	};
	
	var newPath = this._targetPath;
	while (names.length) { newPath = newPath.append(names.shift()); }

	// copy to the same file/dir: create a "copy of" clone 
	if (newPath.equals(node.path)) {
		var name = newPath.getName();
		var parent = newPath.getParent();
		while (newPath.exists()) { 
			name = "Copy of " + name;
			newPath = parent.append(name);
		}
		node.targetName = name; // remember as a "renamed" target name for potential children
	}

	return newPath;
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

// We finished copying this node; figure out what's next
Operation.Copy.prototype._scheduleNext = function() {
	var current = this._node;
	
	while (current.parent && !current.children.length) {
		this._nodeFinished(current);
		if (this._state == Operation.ABORTED) { return; }

		// one step up
		var parent = current.parent;
		var index = parent.children.indexOf(current);
		parent.children.splice(index, 1);
		current = parent;
	}
	
	if (current.children.length) { // still work to do here 
		this._node = current.children[0];
	} else { // finished 
		this._state = Operation.FINISHED;
		this._nodeFinished(current);
	}
}

// This node is finished (including all children). Used only to remove after moving.
Operation.Copy.prototype._nodeFinished = function(node) {}

// Start copying contents from oldPath to newPath
Operation.Copy.prototype._copyContents = function(oldPath, newPath) {
	if (newPath instanceof Path.Zip) { // FIXME? 
		newPath.createFromPath(oldPath);
		this._scheduleNext(); 
		return;
	}
	
	var size = oldPath.getSize() || 0;
	var os;
	var func = function() { os = newPath.outputStream(oldPath.getPermissions()); }
	var created = this._repeatedAttempt(func, newPath.getPath(), "create");
	if (this._state == Operation.ABORTED) { return; }
	
	if (!created) {
		this._count.done += size;
		return;
	}

	this._current.is = oldPath.inputStream();
	this._current.os = os;
	this._current.bytesDone = 0;
	this._current.size = size;
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

Operation.Copy.prototype._done = function() {
	if (this._current.is) {
		this._current.is.close();
		this._current.os.close();
	}
	
	return Operation.prototype._done.apply(this, arguments);
}

*/