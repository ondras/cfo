const type = {
	"mime": "mimetypes",
	"place": "places",
	"action": "actions",
	"emblem": "emblems"
}

const fallback = {
	"audio/wav": "audio/x-wav",
	"audio/ogg": "audio/x-vorbis+ogg",
	"application/x-httpd-php": "application/x-php",
	"application/x-tex": "text/x-tex",
	"application/x-sh": "application/x-shellscript",
	"application/java-archive": "application/x-java-archive",
	"application/x-sql": "text/x-sql",
	"audio/x-flac": "audio/x-flac+ogg",
	"image/x-pixmap": "gnome-mime-image/x-xpixmap",
	"font/otf": "font/x-generic",
	"application/font-woff": "font/x-generic",
	"application/font-woff2": "font/x-generic",
	"application/x-font-ttf": "font/x-generic",
	"audio/mp4": "audio/x-generic",
	"application/vnd.apple.mpegurl": "audio/x-mpegurl"
}

export function formatPath(path) {
	let name = path.name;
	if (name in fallback) { name = fallback[name]; }
	name = name.replace(/\//g, "-");
	return `../img/faenza/${type[path.type]}/16/${name}.png`;
}
