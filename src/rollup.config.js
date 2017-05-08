import includePaths from "rollup-plugin-includepaths";

let includePathsOptions = {
	paths: [`${__dirname}/js`]
};

export default {
	format: "iife",
	plugins: [ includePaths(includePathsOptions) ]
};
