import Pane from "pane.js";
import * as command from "util/command.js";

window.FIXME = (...args) => console.error(...args);

String.prototype.fileLocaleCompare = function(other) {
	for (var i=0;i<Math.max(this.length, other.length);i++) {
		if (i >= this.length) { return -1; } /* this shorter */
		if (i >= other.length) { return  1; } /* other shorter */
		
		let ch1 = this.charAt(i);
		let ch2 = other.charAt(i);
		let c1 = ch1.charCodeAt(0);
		let c2 = ch2.charCodeAt(0);
		
		let special1 = (c1 < 128 && !ch1.match(/a-z/i)); /* non-letter char in this */
		let special2 = (c2 < 128 && !ch2.match(/a-z/i)); /* non-letter char in other */
		
		if (special1 != special2) { return (special1 ? -1 : 1); } /* one has special, second does not */
		
		let r = ch1.localeCompare(ch2); /* locale compare these two normal letters */
		if (r) { return r; }
	}

	return 0; /* same length, same normal/special positions, same localeCompared normal chars */
}

if (!("".padStart)) { 
	String.prototype.padStart = function(len, what = " ") {
		let result = this;
		while (result.length < len) { result = `${what}${result}`; }
		return result;
	}
}

let PANES = [];
let index = -1;

function focus(i) {
	if (index > -1) { PANES[index].blur(); }
	index = i;
	if (index > -1) { PANES[index].focus(); }
}

function build() {
	PANES.push(new Pane());
	PANES.push(new Pane());

	let parent = document.querySelector("#panes");
	PANES.forEach(pane => parent.appendChild(pane.getNode()));
	focus(0);
}

build();

command.register("pane:toggle", "Tab", () => {
	focus((index + 1) % PANES.length);
});

command.register("tab:next", "Ctrl+Tab", () => {
	PANES[index].adjustTab(+1);
});

command.register("tab:prev", "Ctrl+Shift+Tab", () => {
	PANES[index].adjustTab(-1);
});
