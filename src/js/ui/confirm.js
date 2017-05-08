import * as html from "util/html.js";

let resolve;

const body = document.body;
const form = html.node("form", {id:"confirm", className:"dialog"});
const text = html.node("p");
const ok = html.node("button", {type:"submit"}, "OK");
const cancel = html.node("button", {type:"button"}, "Cancel");

form.appendChild(text);
form.appendChild(ok);
form.appendChild(cancel);

form.addEventListener("submit", e => {
	e.preventDefault();
	close(true);
});

cancel.addEventListener("click", e => {
	close(false);
});

function onKeyDown(e) {
	if (e.key == "Escape") { close(false); }
	e.stopPropagation();
}

function close(value) {
	window.removeEventListener("keydown", onKeyDown, true);
	body.classList.remove("modal");
	form.parentNode.removeChild(form);
	resolve(value);
}

export default function confirm(t) {
	html.clear(text);
	text.appendChild(html.text(t));

	body.classList.add("modal");
	body.appendChild(form);
	window.addEventListener("keydown", onKeyDown, true);
	ok.focus();

	return new Promise(r => resolve = r);
}
