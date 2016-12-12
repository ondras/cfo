import Path, {CHILDREN} from "./path.js";

/* fixme tezko rict, jestli cestu takto maskovat, kdyz o patro vys lze jit i klavesovou zkratkou... */
export default class Up extends Path {
	constructor(path) {
		super();
		this._path = path;
	}

	getDescription() { return this._path.getDescription(); }
	getPath() { return this._path.getPath(); }
	getChildren() { return this._path.getChildren(); }
	getParent() { return this._path.getParent(); }
	getImage() { return "up.png"; }

	supports(what) {
		return (what == CHILDREN);
	}
}
