import includePaths from "rollup-plugin-includepaths";
// import graph from "rollup-plugin-graph";

let includePathsOptions = {
	paths: [`${__dirname}/js`]
};

export default {
	format: "iife",
	plugins: [ includePaths(includePathsOptions) ]
};
