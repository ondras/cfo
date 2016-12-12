import LocalPath from "path/local.js";
import List from "list.js";
import Tabs from "tabs.js";

const PARENT = document.querySelector("section");

export default class Pane {
	constructor() {
		this._tabs = new Tabs();
		PARENT.appendChild(this._tabs.getList());
		PARENT.appendChild(this._tabs.getNode());

		let list = new List();
		this._tabs.add(list.getNode());

		let p = new LocalPath("/home/ondras/");
		list.setPath(p); 
	}
}
