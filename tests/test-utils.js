const fs = require("fs");
const path = require("path");

class AssertionException extends Error {
	toString() { return `AssertionException: ${this.message}`; }
}

function assert(expression, message) {
	if (!expression) { throw new AssertionException(message); }
	assert.callCount++;
}
assert.callCount = 0;

function createTree(name, what) {
	switch (typeof(what)) {
		case "object":
			fs.mkdirSync(name);
			for (let p in what) {
				createTree(path.join(name, p), what[p]);
			}
		break;

		case "string":
			fs.appendFileSync(name, what);
		break;

		default: throw new Error(`Cannot create ${name} of type ${typeof(what)}`);
	}
}

function assertTree(name, what) {
	if (what === null) { return assert(!fs.existsSync(name), `${name} shall not exist`); }

	assert(fs.existsSync(name), `${name} shall exist`);

	switch (typeof(what)) {
		case "object":
			let names = fs.readdirSync(name);
			let keys = Object.keys(what);
			assert(names.length == keys.length, `${name} has an incorrect number of descendants`);

			keys.forEach(key => {
				assertTree(path.join(name, key), what[key]);
			});
		break;

		case "string":
			let contents = fs.readFileSync(name);
			assert(contents == what, `${name} has incorrect contents (${contents} vs. ${what})`);
		break;

		default: throw new Error(`Cannot assert ${name} of type ${typeof(what)}`);
	}
}

exports.assert = assert;
exports.assertTree = assertTree;
exports.createTree = createTree;
