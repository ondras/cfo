export const CHILDREN = 0; // list children
export const CREATE   = 1; // create descendants (FIXME APPEND?)
export const READ     = 2; // can we read contents?
export const WRITE    = 3; // can we rename / modify contents?

/*
export const EDIT     = 2; // edit file via the default text editor
export const RENAME   = 3; // quickedit or attempt to move (on a same filesystem)
export const DELETE   = 4; // self-explanatory
export const COPY     = 5; // copy from FIXME pouzivat pro detekci
export const VIEW     = 6; // view using an internal viewer
*/
export default class Path {
	static match(str) { return false; }
	is(other) { return other.toString() == this.toString(); }

	/* sync getters */
	toString() {}
	getName() {}
	getImage() {}
	getDate() {}
	getSize() {}
	getMode() {}
	getDescription() { return this.toString(); }
	getParent() {}
	append(leaf) {}

	/* never fails */
	async stat() {}

	/* these can be called only after stat */
	getSort() { return (this.supports(CHILDREN) ? 1 : 2); }
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
