require("electron").remote = require("./electron-remote-mock").remote;

global.document = {
	createElement() {
		return {
			appendChild() {},
			addEventListener() {}
		}
	},
	createTextNode() {},
	querySelector() {}
}
global.window = {
	addEventListener() {}
}

const process = require("process");
const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const utils = require("./test-utils.js");

function collectFiles() {
	let cwd = process.cwd();
	let names = fs.readdirSync(cwd).filter(x => x.match(/\.js$/))
	return names.map(name => path.join(cwd, name));
}

function collectTests(files) {
	let tests = {};
	for (let file of files) {
		try {
			let e = require(file);
			let t = [];
			for (let p in e) {
//				if (p != "testMoveFileToDir") continue;
				if (p.indexOf("test") == 0) { t.push(e[p]); }
			}
			if (t.length == 0) { continue; }
			tests[file] = t;
			console.log(`Collected ${t.length} tests from ${file}`);
		} catch (e) {
			console.warn(`Skipping un-requireable ${file} (${e.message})`);
		}
	}
	return tests;
}

async function runTests(tests, tmp) {
	console.log("");

	let stats = {
		passed: 0,
		failed: 0
	};

	for (let file in tests) {
		let t = tests[file];
		process.stdout.write(`${file}: `);
		for (let test of t) {
			child_process.execSync(`mkdir -p "${tmp}"`);
			try {
				await test(tmp);
				stats.passed++;
				process.stdout.write(".");
			} catch (e) {
				stats.failed++;
				process.stdout.write("F\n");
				process.stderr.write(`${test.name}: ${e}\n`);
				process.stderr.write(`${e.stack}\n`);
			} finally {
				child_process.execSync(`rm -rf "${tmp}"`);
			}
		}
		process.stdout.write("\n");
	}

	stats.asserts = utils.assert.callCount;
	return stats;
}

async function run() {
	const tmp = path.join(process.cwd(), "test-tmp");

	let files = collectFiles();
	let tests = collectTests(files);
	let stats = await runTests(tests, tmp);
	let exitCode = 0;

	console.log(stats);
	if (stats.failed > 0) {
		exitCode = 1;
		console.log("Some tests FAILED");
	} else {
		console.log("All tests PASSED");
	}

	require("electron").app.exit(exitCode);
}

run();
