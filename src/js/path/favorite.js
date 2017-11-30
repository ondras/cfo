import * as favorites from "util/favorites.js";
import * as icons from "util/icons.js";
import Path, {WRITE} from "./path.js";

export default class Favorite extends Path {
	constructor(path, index) {
		super();
		this._path = path;
		this._index = index;
	}

	toString() { return this._path.toString(); }
	getName() { return this.toString(); }
	getSize() { return this._index; }
	getImage() { return icons.create("favorite"); }
	getSort() { return (this._index == 0 ? 10 : this._index); }

	supports(what) {
		if (what == WRITE) { return true; }
		return false;
	}

	delete() {
		favorites.remove(this._index);
	}

	activate(list) {
		list.setPath(this._path);
	}
}
