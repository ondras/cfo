import * as favorites from "util/favorites.js";
import * as icons from "util/icons.js";
import Path, {DELETE} from "./path.js";

export default class Favorite extends Path {
	constructor(path, index) {
		super();
		this._path = path;
		this._index = index;
	}

	toString() { return this._path.toString(); }
	getName() { return this.toString(); }
	getSize() { return this._index; }
	getImage() { return icons.get("favorite"); }

	supports(what) {
		if (what == DELETE) { return true; }
		return false;
	}

	delete() {
		favorites.remove(this._index);
	}

	activate(list) {
		list.setPath(this._path);
	}
}
