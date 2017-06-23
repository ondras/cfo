export default class Path {
	is(other) { return other.getPath() == this.getPath(); }
	getPath() {}

	getName() {}
	getImage() {}
	getDate() {}
	getSize() {}
	getMode() {}
	getDescription() {}

	supports(what) {}
	getParent() {}
	async getChildren() {}
	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
	append(leaf) {}
	async create(opts) {}
	async rename(newPath) {}
	async delete() {}

	createStream(type) {}
}

export const CHILDREN = 0; // list children
export const CREATE = 1; // create descendants
export const EDIT = 2; // edit file via the default text editor
export const RENAME = 3; // quickedit or attempt to move (on a same filesystem)
export const DELETE = 4; // self-explanatory
