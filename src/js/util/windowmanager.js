let issues = [];
let progresses = [];
let current = null;

function sync() {
	let active = null;
	if (progresses.length) { active = progresses[0]; }
	if (issues.length) { active = issues[0]; }
	if (current && current != active) { current.hide(); }
	current = active;
	if (current) { current.show(); }
}

export function addIssue(window) {
	issues.unshift(window);
	sync();
}

export function removeIssue(window) {
	let index = issues.indexOf(window);
	issues.splice(index, 1);
	if (current == window) { current = null; } // will hide/close itself
	sync();
}

export function addProgress(window) {
	progresses.unshift(window);
	sync();
}

export function removeProgress(window) {
	let index = progresses.indexOf(window);
	progresses.splice(index, 1);
	if (current == window) { current = null; } // will hide/close itself
	sync();
}
