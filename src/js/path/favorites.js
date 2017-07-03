import * as favorites from "util/favorites.js";
import Path, {CHILDREN} from "./path.js";
import Favorite from "./favorite.js";

export default class Favorites extends Path {
	static match(str) { return str.match(/^fav:/i); }

	toString() { return "fav:"; }
	getName() { return "Favorites"; }
	supports(what) {
		if (what == CHILDREN) { return true; }
		return false;
	}

	getChildren() {
		return favorites.list().map((path, index) => {
			return path ? new Favorite(path, index) : null;
		}).filter(path => path);
	}
}
