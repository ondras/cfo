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
	getChildren() {}
	activate(list) {
		if (this.supports(CHILDREN)) { list.setPath(this); }
	}
	append(leaf) {}
	create(opts) {}
}

export const CHILDREN = 0; // list children
export const CREATE = 1; // create descendants
export const EDIT = 2; // edit file via the default text editor
