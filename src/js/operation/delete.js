import Progress from "ui/progress.js";
import Operation from "./operation.js";
import Scan from "./scan.js";

export default class Delete extends Operation {
	constructor(path) {
		super();
		this._path = path;
		this._record = null;
	}

	run() {
		return new Scan(this._path).run().then(root => {
			if (!root) { return Promise.resolve(false); }
			return this._startDeleting(root);
		});
	}

	_startDeleting(record) {
		this._record = record;

		let options = {
			title: "Deleting…",
			row1: "Total:",
			progress1: " "

		}
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._doDelete();
	}

	_doDelete() {
		if (this._aborted) { return Promise.resolve(false); }

		// descend to first deletable node
		while (this._record.children && this._record.children.length > 0) {
			this._record = this._record.children[0];
		}

		// show where are we FIXME stats etc
		var path = this._record.path;
		this._progress.update({row1:path.getPath()});

		return path.delete().then(() => {
			this._record = this._record.parent;
			if (this._record) {
				this._record.children.shift();
				return this._doDelete();
			}
			return true;
		}, e => this._handleError(e));
	}

	_handleError(e) {
		let text = e.message;
		let title = "Error deleting file/directory";
		let buttons = ["retry", "abort"];
		let config = { text, title, buttons };
		return this._processIssue("delete", config).then(result => {
			switch (result) {
				case "retry": return this._doDelete(); break;
				case "abort": this.abort(); return null; break;
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
