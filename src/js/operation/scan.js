import Progress from "ui/progress.js";
import Operation from "./operation.js";
import {CHILDREN} from "path/path.js";

function createRecord(path, parent) {
	return {
		path,
		parent,
		children: null,
		count: 1,
		size: 0
	};
}

export default class Scan extends Operation {
	constructor(path) {
		super();

		this._root = createRecord(path, null);

		let options = {
			title: "Directory scanning…",
			row1: "Scanning:",
			progress1: " "
		}
		this._progress = new Progress(options);
		this._progress.onClose = () => this.abort();
	}

	async run() {
		super.run(); // schedule progress window
		await this._analyze(this._root);
		this._end();
		return (this._aborted ? null : this._root);
	}

	async _analyze(record) {
		if (this._aborted) { return; }
		this._progress.update({row1: record.path.getPath()});

		if (record.path.supports(CHILDREN)) { /* descend, recurse */
			return this._analyzeDirectory(record);
		} else { /* compute */
			return this._analyzeFile(record);
		}
	}

	async _analyzeDirectory(record) {
		try {
			let children = await record.path.getChildren();
			record.children = children.map(ch => createRecord(ch, record));
			let promises = record.children.map(r => this._analyze(r));
			return Promise.all(promises);
		} catch (e) {
			return this._handleError(e, record);
		}
	}

	async _analyzeFile(record) {
		try {
			await record.path.stat();

			record.size = record.path.getSize(); /* update this one */

			let current = record;
			while (current.parent) { /* update all parents */
				current.parent.count += record.count;
				current.parent.size += record.size;
				current = current.parent;
			}

		} catch (e) {
			return this._handleError(e, record);
		}
	}

	async _handleError(e, record) {
		let text = e.message;
		let title = "Error reading file/directory";
		let buttons = ["retry", "skip", "skip-all", "abort"];
		let result = await this._processIssue("scan", { text, title, buttons });

		switch (result) {
			case "retry": return this._analyze(record); break;
			case "abort": this.abort(); return false; break;
			default: return false; break;
		}
	}
}
