export default class Path {
	is(other) { return other.getPath() == this.getPath(); }

	/* sync getters */
	getPath() {}
	getName() {}
	getImage() {}
	getDate() {}
	getSize() {}
	getMode() {}
	getDescription() {}
	getParent() {}
	append(leaf) {}

	/* never fails */
	async stat() {}

	/* these can be called only after stat */
	exists() {}
	supports(what) {}
	async getChildren() {}

	/* misc */
	async create(opts) {}
	async rename(newPath) {}
	async delete() {}
	async setDate(date) {}
	createStream(type, opts) {}

	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
}

export const CHILDREN = 0; // list children
export const CREATE = 1; // create descendants
export const EDIT = 2; // edit file via the default text editor
export const RENAME = 3; // quickedit or attempt to move (on a same filesystem)
export const DELETE = 4; // self-explanatory
