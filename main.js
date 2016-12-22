const {app, BrowserWindow, remote, Menu} = require("electron");
const pkg = require("./package.json");

app.on("window-all-closed", () => {
	if (process.platform != "darwin") { app.quit(); }
});

app.on("ready", () => {
	Menu.setApplicationMenu(null);
	let options = {
		width: pkg.window.width,
		height: pkg.window.height,
		icon: `${__dirname}/icon.png`
	}
	let win = new BrowserWindow(options);
	win.setMenu(null);

	win.loadURL(`file://${__dirname}/index.html`);
	win.openDevTools();
});
