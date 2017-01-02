import includePaths from "rollup-plugin-includepaths";

let includePathsOptions = {
	paths: [`${__dirname}/js`]
};

export default {
    entry: `${__dirname}/js/app.js`,
    format: "iife",
    plugins: [ includePaths(includePathsOptions) ]
};
