export default class Path {
	is(other) { return other.getPath() == this.getPath(); }
	getName() {}
	getPath() {}
	getParent() {}
	getChildren() {}
	getDate() { }
	getSize() { }
	getMode() { }
	supports(what) {}
	activate() {}
}

export const CHILDREN = 0;
