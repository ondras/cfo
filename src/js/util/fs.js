const promisify = require("util").promisify;
const fs = require("fs");

export const readlink = promisify(fs.readlink);
export const readdir = promisify(fs.readdir);
export const mkdir = promisify(fs.mkdir);
export const rmdir = promisify(fs.rmdir);
export const open = promisify(fs.open);
export const close = promisify(fs.close);
export const rename = promisify(fs.rename);
export const unlink = promisify(fs.unlink);
export const utimes = promisify(fs.utimes);
export const symlink = promisify(fs.symlink);
