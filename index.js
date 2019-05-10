const {app, BrowserWindow, remote, Menu} = require("electron");
const settings = require("electron-settings");

app.on("window-all-closed", () => {
	if (process.platform != "darwin") { app.quit(); }
});

app.on("ready", () => {
	let position = settings.get("window.position", [16, 16]);
	let size = settings.get("window.size", [800, 600]);
	let options = {
		width: size[0],
		height: size[1],
		x: position[0],
		y: position[1],
		icon: `${__dirname}/icon.png`,
		backgroundColor: "#e8e8e8",
		webPreferences: { nodeIntegration: true }
	}
	let win = new BrowserWindow(options);
	win.loadURL(`file://${__dirname}/app/index.html`);
//	win.toggleDevTools();
});
