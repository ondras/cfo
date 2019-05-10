import * as html from "util/html.js";

export default class QuickEdit {
	constructor() {
		this._resolve = null;
		this._oldValue = "";

		this._input = html.node("input", {type:"text"});
		this._input.addEventListener("keydown", this);
	}

	start(value, cell) {
		this._oldValue = value; /* remember so we can put it back on escape */

		let image = cell.querySelector("img, canvas");
		let width = cell.offsetWidth - image.offsetWidth;
		while (image.nextSibling) {
			image.nextSibling.parentNode.removeChild(image.nextSibling);
		}

		cell.appendChild(this._input);
		this._input.style.width = `${width}px`;

		this._input.value = value;
		this._input.focus();
		this._input.selectionStart = 0;

		let r = value.match(/\.[^\.]+$/);
		let len = value.length;
		this._input.selectionEnd = (r && r[0] != value ? len-r[0].length : len);

		return new Promise(resolve => this._resolve = resolve);
	}

	stop() {
		if (!this._resolve) { return; }

		this._input.parentNode.replaceChild(html.text(this._oldValue), this._input);
		this._resolve = null;
	}

	handleEvent(e) {
		e.stopPropagation();

		switch (e.key) {
			case "Enter":
				this._resolve(this._input.value);
				this.stop();
			break;

			case "Escape":
				this.stop();
			break;
		}
	}
}