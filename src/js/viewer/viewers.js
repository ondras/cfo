import * as text from "./text/remote.js";
import * as image from "./image/remote.js";

const viewers = [image, text];

export function view(path) {
	for (let viewer of viewers) {
		if (viewer.match(path)) { return viewer.view(path); }
	}
}
