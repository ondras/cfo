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

exports.testMoveDir = async function testMoveDir(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = {
		"file": "test file",
		"subdir": {}
	};

	createTree(source, contents);

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, null);
	assertTree(target, contents);
}

exports.testMoveFileToDir = async function testMoveFileToDir(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = "test file";

	createTree(source, contents);
	createTree(target, {});

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, null);
	assertTree(target, {"a":contents});
}

exports.testMoveOverwrite = async function testMoveOverwrite(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = "test file";

	createTree(source, contents);
	createTree(target, {"a":"old contents"});

	require("electron").remote.issueResolution = "overwrite";

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, null);
	assertTree(target, {"a":contents});
}

exports.testMoveAbort = async function testMoveAbort(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = "test file";

	createTree(source, contents);
	createTree(target, {"a":"old contents"});

	require("electron").remote.issueResolution = "abort";

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, contents);
	assertTree(target, {"a":"old contents"});
}

exports.xtestMoveSkip = async function testMoveSkip(tmp) {
	const source = path.join(tmp, "a");
	const target = path.join(tmp, "b");
	const contents = {"file": "test file", "file.new": "test file"};
	const targetContents = {"a": {"file": "old contents file"}};

	createTree(source, contents);
	createTree(target, targetContents);

	require("electron").remote.issueResolution = "skip";

	let o = new Move(
		paths.fromString(source),
		paths.fromString(target)
	);
	await o.run();

	assertTree(source, contents);
	assertTree(target, targetContents);
}
