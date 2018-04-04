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
	"text/less": "text/x-scss",
	"text/coffeescript": "application/vnd.coffeescript",
	"application/x-sql": "application/sql",
	"application/font-woff": "font/woff",
	"application/font-woff2": "font/woff",
	"application/rdf+xml": "text/rdf+xml",
	"application/vnd.apple.mpegurl": "audio/x-mpegurl"
}

export function formatPath(path) {
	let name = path.name;
	if (name in fallback) { name = fallback[name]; }
	name = name.replace(/\//g, "-");
	return `../img/numix/${type[path.type]}/${name}.svg`;
}

