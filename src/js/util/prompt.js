import * as html from "util/html.js";

let resolve;

let form = html.node("form", {id:"prompt"});
let text = html.node("p");
let input = html.node("input", {type:"text"});
let ok = html.node("button", {type:"submit"}, "OK");
let cancel = html.node("button", {type:"button"}, "Cancel");

form.appendChild(text);
form.appendChild(input);
form.appendChild(ok);
form.appendChild(cancel);

form.addEventListener("submit", e => {
	e.preventDefault();
	close(input.value);
})

function onKeyDown(e) {
	if (e.key == "Escape") { close(null); }
	e.stopPropagation();
}

function close(value) {
	window.removeEventListener("keydown", onKeyDown, true);
	form.parentNode.removeChild(form);
	resolve(value);
}

export default function prompt(t, value = "") {
	html.clear(text);
	text.appendChild(html.text(t));
	input.value = value;

	document.body.appendChild(form);
	window.addEventListener("keydown", onKeyDown, true);
	input.focus();

	return new Promise(r => resolve = r);
}
