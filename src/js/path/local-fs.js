const fs = require("fs");
const path = require("path");

export function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs.readlink(linkPath, (err, targetPath) => {
			if (err) { reject(err); } else {
				let linkDir = path.dirname(linkPath);
				let finalPath = path.resolve(linkDir, targetPath);
				resolve(finalPath);
			}
		});
	});
}

export function readdir(path) {
	return new Promise((resolve, reject) => {
		fs.readdir(path, (err, files) => {
			if (err) { reject(err); } else { resolve(files); }
		});
	});
}

export function mkdir(path, mode) {
	return new Promise((resolve, reject) => {
		fs.mkdir(path, mode, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

export function open(path, flags, mode) {
	return new Promise((resolve, reject) => {
		fs.open(path, flags, mode, (err, fd) => {
			if (err) { reject(err); } else { resolve(fd); }
		});
	});
}

export function close(fd) {
	return new Promise((resolve, reject) => {
		fs.close(fd, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}

export function rename(oldPath, newPath) {
	return new Promise((resolve, reject) => {
		fs.rename(oldPath, newPath, err => {
			if (err) { reject(err); } else { resolve(); }
		});
	})
}
