import LocalPath from "path/local.js";
import List from "list.js";

window.FIXME = (...args) => console.error(...args);

let list = new List();

let p = new LocalPath("/tmp");
list.setPath(p); 
