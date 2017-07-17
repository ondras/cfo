import Issue from "issue/remote.js"

const TIMEOUT = 500;

export default class Operation {
	constructor() {
		this._timeout = null;
		this._progress = null;
		this._aborted = false;
		this._issues = {}; // list of potential issues and user resolutions
	}

	async run() {
		this._timeout = setTimeout(() => this._showProgress(), TIMEOUT);
	}

	abort() {
		this._aborted = true;
	}

	_end() {
		clearTimeout(this._timeout);
		this._progress && this._progress.close();
	}

	_showProgress() {
		this._progress && this._progress.open();
	}

	async _processIssue(type, config) {
		if (type in this._issues) {
			return this._issues[type];
		} else {
			let issue = new Issue(config);
			let result = await issue.open();
			if (result.match("-all")) { this._issues[type] = result; } // remember for futher occurences
			return result;
		}
	}
}
