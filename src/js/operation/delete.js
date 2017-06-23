import Progress from "ui/progress.js";
import Operation from "./operation.js";
import Scan from "./scan.js";

export default class Delete extends Operation {
	constructor(path) {
		super();
		this._path = path;
	}

	async run() {
		let scan = new Scan(this._path);
		let root = await scan.run(); 
		if (!root) { return false; }
		return this._startDeleting(root);
	}

	async _startDeleting(record) {
		let options = {
			title: "Deleting…",
			row1: "Total:",
			progress1: " "

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

		// show where are we FIXME stats etc
		var path = record.path;
		this._progress.update({row1:path.getPath()});

		try {
			await path.delete();
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
			case "abort": this.abort(); return false; break;
			default: return false; break;
		}
	}
}
