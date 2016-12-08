export default class List {
	constructor() {

	}

	setPath(path) {
		path.getChildren().then(paths => this._show(paths), FIXME);
	}

	_show(paths) {
		let table = document.createElement("table");
		paths.forEach(path => {
			let row = table.insertRow();
			row.insertCell().innerHTML = path.getName();
			row.insertCell().innerHTML = path.isDirectory();
			row.insertCell().innerHTML = path.isSymbolicLink() ? path.follow().getName() : "n/a";
		});
		document.body.appendChild(table);
	}
}
