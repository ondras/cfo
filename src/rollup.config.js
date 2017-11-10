import includePaths from "rollup-plugin-includepaths";
// import graph from "rollup-plugin-graph";

let includePathsOptions = {
	paths: [`${__dirname}/js`]
};

export default {
	output: {
		format: "iife"
	},
	plugins: [ includePaths(includePathsOptions) ]
};
