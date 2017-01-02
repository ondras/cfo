const TIMEOUT = 50;

export default class Operation {
	constructor() {
		this._timeout = null;
		this._progress = null;
	}

	run() {
		this._timeout = setTimeout(() => this._showProgress(), TIMEOUT);
		return Promise.resolve();
	}

	_end(result) {
		clearTimeout(this._timeout);
		this._progress && this._progress.close();
		return result;
	}

	_showProgress() {
		this._progress && this._progress.open();
	}
}
