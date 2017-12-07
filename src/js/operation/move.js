import Copy from "./copy.js";
import {CHILDREN} from "path/path.js";

export default class Move extends Copy {
	constructor(sourcePath, targetPath) {
		super(sourcePath, targetPath);
		this._texts = {
			title: "Moving in progress",
			row1: "Moving:"
		}
	}

	async _copy(record, targetPath) {
//		try {
//			return record.path.rename(targetPath);
//		} catch (e) {} // quick rename failed, need to copy+delete

		await super._copy(record, targetPath);

		if (this._aborted)  { return; }
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

	async _resolveExistingTarget(targetPath, record) {
		// existing file
		if (!targetPath.supports(CHILDREN)) { return targetPath; }

		// existing dir
		targetPath = targetPath.append(record.path.getName());
		await targetPath.stat();

		return targetPath;
	}
}
