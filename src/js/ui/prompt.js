import * as html from "util/html.js";

let resolve;

const body = document.body;
const form = html.node("form", {id:"prompt"});
const text = html.node("p");
const input = html.node("input", {type:"text"});
const ok = html.node("button", {type:"submit"}, "OK");
const cancel = html.node("button", {type:"button"}, "Cancel");

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
	body.classList.remove("modal");
	form.parentNode.removeChild(form);
	resolve(value);
}

export default function prompt(t, value = "") {
	html.clear(text);
	text.appendChild(html.text(t));
	input.value = value;

	body.classList.add("modal");
	body.appendChild(form);
	window.addEventListener("keydown", onKeyDown, true);
	input.selectionStart = 0;
	input.selectionEnd = input.value.length;
	input.focus();

	return new Promise(r => resolve = r);
}
