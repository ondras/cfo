import Progress from "ui/progress.js";
import Operation from "./operation.js";
import {CHILDREN} from "path/path.js";

function createRecord(path, parent) {
	return {
		path,
		parent,
		children: [],
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
	}

	run() {
		super.run();
		return this._analyze(this._root).then(x => this._end(x));
	}

	_analyze(record) {
		this._progress.update({row1: record.path.getPath()});

		if (record.path.supports(CHILDREN)) { /* descend, recurse */
			return this._analyzeDirectory(record).then(x => {
				return new Promise(resolve => setTimeout(() => resolve(x), 150));
			});
		} else { /* compute */
			return this._analyzeFile(record);
		}
	}

	_analyzeDirectory(record) {
		return record.path.getChildren().then(children => {
			record.children = children.map(ch => createRecord(ch, record));
			let promises = record.children.map(r => this._analyze(r));
			return Promise.all(promises).then(() => record); /* fulfill with the record */
		}); /* fixme reject */
	}

	_analyzeFile(record) {
		return record.path.stat().then(() => {
			record.size = record.path.getSize(); /* update this one */

			let current = record;
			while (current.parent) { /* update all parents */
				current.parent.count += record.count;
				current.parent.size += record.size;
				current = current.parent;
			}

			return record;
		}); /* fixme reject */
	}
}
