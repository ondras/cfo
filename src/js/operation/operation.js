import Issue from "ui/issue.js"

const TIMEOUT = 500;

export default class Operation {
	constructor() {
		this._timeout = null;
		this._progress = null;
		this._aborted = false;
		this._issues = {}; // list of potential issues and user resolutions
	}

	run() {
		this._timeout = setTimeout(() => this._showProgress(), TIMEOUT);
		return Promise.resolve();
	}

	abort() {
		this._aborted = true;
	}

	_end(result) {
		clearTimeout(this._timeout);
		this._progress && this._progress.close();
		return result;
	}

	_showProgress() {
//		this._progress && this._progress.open(); fixme interferuje s issue
	}

	_processIssue(type, config) {
		if (type in this._issues) {
			return Promise.resolve(this._issues[type]);
		} else {
			return new Issue(config).open().then(result => {
				if (result.match("-all")) { this._issues[type] = result; } // remember for futher occurences
				return result;
			});
		}
	}
}
