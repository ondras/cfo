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

	async _copyDirectory(record, targetPath) {
		let renamed = await this._rename(record, targetPath);
		if (renamed) { return true; }

		let copied = await super._copyDirectory(record, targetPath);
		return (copied ? this._delete(record) : false);
	}

	async _copyFile(record, targetPath) {
		if (targetPath.exists()) { // target exists: overwrite/skip/abort
			let canOverwrite = await this._canOverwrite(record, targetPath);
			if (!canOverwrite)  { return false; }
		}

		let renamed = await this._rename(record, targetPath);
		if (renamed) { return true; }

		let copied = await super._copyFile(record, targetPath);
		return (copied ? this._delete(record) : false);
	}

	async _rename(record, targetPath) {
		try {
//			console.log("rename", record.path+"", targetPath+"");
			await record.path.rename(targetPath);
			this._stats.done += record.size;
//			console.log("ok");
			return true;
		} catch (e) { /*console.log("rename failed");*/return false; } // quick rename failed, need to copy+delete
	}

	async _delete(record) {
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
			case "retry": return this._delete(record); break;
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
