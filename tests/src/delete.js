import Delete from "operation/delete.js";
import * as paths from "path/paths.js";

const path = require("path");
const { createTree, assert, assertTree } = require("./test-utils.js");

exports.testDeleteFile = async function testDeleteFile(tmp) {
	const root = path.join(tmp, "a");
	const contents = "test file";

	createTree(root, contents);
	assertTree(root, contents);

	let o = new Delete(paths.fromString(root));
	let result = await o.run();

	assert(result);
	assertTree(root, null);
}

exports.testDeleteDirectory = async function testDeleteDirectory(tmp) {
	const root = path.join(tmp, "a");
	const contents = {"b": { "c": "d"}, "c": "d", "e": {}};
	createTree(root, contents);
	assertTree(root, contents);

	let o = new Delete(paths.fromString(root));
	let result = await o.run();

	assert(result);
	assertTree(root, null);
}

exports.testDeleteGroup = async function testDeleteGroup(tmp) {
	const dir1 = path.join(tmp, "a");
	const dir2 = path.join(tmp, "b");
	const file1 = path.join(tmp, "c");
	const file2 = path.join(tmp, "d");

	createTree(dir1, {});
	createTree(dir2, {});
	createTree(file1, "aaa");
	createTree(file2, "aaa");

	let g = paths.group([
		paths.fromString(dir1),
		paths.fromString(file1)
	]);

	let o = new Delete(g);
	let result = await o.run();

	assert(result);
	assertTree(dir1, null);
	assertTree(file1, null);
	assertTree(dir2, {});
	assertTree(file2, "aaa");
}

exports.testDeleteSymlinkDirectory = async function testDeleteSymlinkDirectory(tmp) {
	const dir1 = path.join(tmp, "a");
	const contents = {"b": "aaa"};
	createTree(dir1, contents);
	assertTree(dir1, contents);

	const dir2 = path.join(tmp, "b");
	const path2 = paths.fromString(dir2);
	await path2.create({link:dir1});

	let o = new Delete(paths.fromString(dir2));
	let result = await o.run();

	assert(result);
	assertTree(dir1, contents);
}
