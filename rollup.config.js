import includePaths from "rollup-plugin-includepaths";

export default {
    entry: "src/app.js",
    dest: "app.js",
    format: "iife",
    plugins: [ includePaths() ]
};
