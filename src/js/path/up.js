import Path, {CHILDREN} from "./path.js";

/* fixme tezko rict, jestli cestu takto maskovat, kdyz o patro vys lze jit i klavesovou zkratkou... */
export default class Up extends Path {
	constructor(path) {
		super();
		this._path = path;
	}

	getImage() { return "up.png"; }
	getDescription() { return this._path.getDescription(); }
	toString() { return this._path.toString(); }
	activate(list) { list.setPath(this._path); }

	supports(what) {
		return (what == CHILDREN);
	}
}
