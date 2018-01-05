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
		if (this._aborted) { return false; }

		await targetPath.stat();
		if (targetPath.exists()) { targetPath = await this._resolveExistingTarget(targetPath, record); }

		try {
//			console.log("rename", record.path+"", targetPath+"");
			await record.path.rename(targetPath);
			this._stats.done += record.size;
//			console.log("ok");
			return true;
		} catch (e) { /*console.log("rename failed");*/ } // quick rename failed, need to copy+delete

		let result = await super._copy(record, targetPath);
		if (!result)  { return false; }

		try {
			await record.path.delete();
			return true;
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

		// existing dir: append leaf name
		targetPath = targetPath.append(record.path.getName());
		await targetPath.stat();
		return targetPath;
	}
}
