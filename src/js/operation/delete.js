import Progress from "progress/remote.js";
import Operation from "./operation.js";
import Scan from "./scan.js";

export default class Delete extends Operation {
	constructor(path) {
		super();
		this._path = path;
		this._stats = {
			total: 0,
			done: 0
		}
	}

	async run() {
		let scan = new Scan(this._path);
		let root = await scan.run(); 
		if (!root) { return false; }

		this._stats.total = root.count;
		let result = await this._startDeleting(root);
		this._end();
		return result;
	}

	async _startDeleting(record) {
		let options = {
			title: "Deletion in progress",
			row1: "Deleting:",
			progress1: "Total:"
		}
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();

		super.run(); // schedule progress window

		return this._delete(record);
	}

	async _delete(record) {
		if (this._aborted) { return false; }

		let deleted = true;

		if (record.children !== null) {
			for (let child of record.children) {
				let childDeleted = await this._delete(child); 
				if (!childDeleted) { deleted = false; }
			}
		}

		if (!deleted) { return false; }

		var path = record.path;
		this._progress.update({row1:path.toString(), progress1:100*this._stats.done/this._stats.total});

		try {
			await path.delete();
			this._stats.done++;
			return true;
		} catch (e) {
			return this._handleError(e, record);
		}
	}

	async _handleError(e, record) {
		let text = e.message;
		let title = "Error deleting file/directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("delete", { text, title, buttons });
		switch (result) {
			case "retry": return this._delete(record); break;
			case "abort": this.abort(); break;
		}
		return false;
	}
}
