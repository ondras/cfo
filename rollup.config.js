import includePaths from "rollup-plugin-includepaths";

export default {
    entry: "src/js/app.js",
    dest: "app.js",
    format: "iife",
    plugins: [ includePaths() ]
};
