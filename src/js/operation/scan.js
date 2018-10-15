import Progress from "progress/remote.js";
import Operation from "./operation.js";
import {CHILDREN} from "path/path.js";
import LocalPath from "path/local.js";

function createRecord(path) {
	return {
		path,
		children: null,
		count: 1,
		size: 0
	};
}

export default class Scan extends Operation {
	constructor(path) {
		super();

		this._path = path;

		let options = {
			title: "Directory scan in progress",
			row1: "Scanning:",
			progress1: ""
		}
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();
	}

	async run() {
		super.run(); // schedule progress window
		let result = await this._analyze(this._path);
		this._end();
		return result;
	}

	async _analyze(path) {
		if (this._aborted) { return null; }
		this._progress.update({row1: path.toString()});

		await path.stat();

		if (path instanceof LocalPath && path.isSymbolicLink()) {
			return this._analyzeFile(path);
		} else if (path.supports(CHILDREN)) { // descend, recurse
			return this._analyzeDirectory(path);
		} else { // compute
			return this._analyzeFile(path);
		}
	}

	async _analyzeDirectory(path) {
		try {
			let record = createRecord(path);
			record.children = [];

			let children = await path.getChildren();
			let promises = children.map(childPath => this._analyze(childPath));
			children = await Promise.all(promises);

			children.forEach(child => {
				record.children.push(child);
				if (!child) { return; }
				record.count += child.count;
				record.size += child.size;
			});
			return record;
		} catch (e) {
			return this._handleError(e, path);
		}
	}

	_analyzeFile(path) {
		let record = createRecord(path);
		record.size = record.path.getSize();
		return record;
	}

	async _handleError(e, path) {
		let text = e.message;
		let title = "Error reading file/directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("scan", { text, title, buttons });

		switch (result) {
			case "retry": return this._analyze(path); break;
			case "abort": this.abort(); return null; break;
			default: return null; break;
		}
	}
}
