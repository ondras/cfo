const {app, BrowserWindow, remote, Menu} = require("electron");
const settings = require("electron-settings");

app.on("window-all-closed", () => {
	if (process.platform != "darwin") { app.quit(); }
});

app.on("ready", () => {
	let size = settings.get("window.size") || [800, 600];
	let options = {
		width: size[0],
		height: size[1],
		icon: `${__dirname}/icon.png`
	}
	let win = new BrowserWindow(options);

	win.on("resize", () => {
		settings.set("window.size", win.getSize());
	});

	win.loadURL(`file://${__dirname}/index.html`);
});
