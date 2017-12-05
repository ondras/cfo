import Move from "operation/move.js";
import * as paths from "path/paths.js";

const path = require("path");
const { createTree, assert, assertTree } = require("./test-utils.js");

exports.testMoveFile = async function testMoveFile(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = "test file";

	createTree(source, contents);

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, null);
	assertTree(target, contents);
}
