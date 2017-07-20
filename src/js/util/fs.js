const fs = require("fs");

export function readlink(linkPath) {
	return new Promise((resolve, reject) => {
		fs.readlink(linkPath, (err, target) => {
			err ? reject(err) : resolve(target);
		});
	});
}

export function readdir(path) {
	return new Promise((resolve, reject) => {
		fs.readdir(path, (err, files) => {
			err ? reject(err) : resolve(files);
		});
	});
}

export function mkdir(path, mode) {
	return new Promise((resolve, reject) => {
		fs.mkdir(path, mode, err => {
			err ? reject(err) : resolve();
		});
	});
}

export function open(path, flags, mode) {
	return new Promise((resolve, reject) => {
		fs.open(path, flags, mode, (err, fd) => {
			err ? reject(err) : resolve(fd);
		});
	});
}

export function close(fd) {
	return new Promise((resolve, reject) => {
		fs.close(fd, err => {
			err ? reject(err) : resolve();
		});
	})
}

export function rename(oldPath, newPath) {
	return new Promise((resolve, reject) => {
		fs.rename(oldPath, newPath, err => {
			err ? reject(err) : resolve();
		});
	})
}

export function unlink(path) {
	return new Promise((resolve, reject) => {
		fs.unlink(path, err => {
			err ? reject(err) : resolve();
		});
	});
}

export function rmdir(path) {
	return new Promise((resolve, reject) => {
		fs.rmdir(path, err => {
			err ? reject(err) : resolve();
		});
	});
}

export function utimes(path, atime, mtime) {
	return new Promise((resolve, reject) => {
		fs.utimes(path, atime, mtime, err => {
			err ? reject(err) : resolve();
		});
	});
}

export function symlink(target, path) {
	return new Promise((resolve, reject) => {
		fs.symlink(target, path, err => {
			err ? reject(err) : resolve();
		});
	});
}
