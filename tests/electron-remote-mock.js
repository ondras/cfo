const remote = {
	issueResolution: "abort",
	getCurrentWindow() {},
	ipcMain: {
		once(action, cb) {
			setTimeout(() => cb(null, remote.issueResolution), 0);
		}
	}
};

class BrowserWindow {
	constructor() {
		this.webContents = {
			once() {},
			send() {}
		}
	}
	on() {}
	setMenu() {}
	loadURL() {}
	show() {}
	close() {}
	hide() {}
	destroy() {}
}

remote.BrowserWindow = BrowserWindow;

exports.remote = remote;
