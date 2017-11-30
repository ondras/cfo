import Path, {CHILDREN} from "./path.js";

export default class Group extends Path {
	constructor(paths) {
		super();
		this._paths = paths;
	}

	getName() { return ""; } /* appending this group's name = noop; useful for recursive operations */

	async getChildren() { return this._paths; }

	supports(what) {
		switch (what) {
			case CHILDREN:
				return true;
			break;

			default:
				return this._paths.every(item => item.supports(what));
			break;
		}
	}

	toString() { return `${this._paths.length} items`; }

	async rename(newPath) {
		for (let path of this._paths) {
			let child = newPath.append(path.getName());
			await path.rename(child);
		}
	}
}
