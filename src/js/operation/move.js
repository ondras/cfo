import Copy from "./copy.js";
import {RENAME} from "path/path.js";

export default class Move extends Copy {
	constructor(sourcePath, targetPath) {
		super(sourcePath, targetPath);
		this._texts = {
			title: "Moving in progress",
			row1: "Moving:"
		}
	}

	async _startCopying(root) {
		if (root.path.supports(RENAME)) {
			let targetPath = this._targetPath;
			await targetPath.stat();
			if (targetPath.exists()) { targetPath = targetPath.append(root.path.getName()); }
			try {
				return root.path.rename(targetPath);
			} catch (e) {} // quick rename failed, need to copy+delete
		}
		return super._startCopying(root);
	}

	async _recordCopied(record) {
		try {
			await record.path.delete();
		} catch (e) {
			return this._handleDeleteError(e, record);
		}
	}

	async _handleDeleteError(e, record) {
		let text = e.message;
		let title = "Error deleting file";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("delete", { text, title, buttons });
		switch (result) {
			case "retry": return this._recordCopied(record); break;
			case "abort": this.abort(); break;
		}
	}
}
