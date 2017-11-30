import includePaths from "rollup-plugin-includepaths";

let includePathsOptions = {
	paths: [`${__dirname}/../src/js`]
};

export default {
	output: {
		format: "iife"
	},
	plugins: [ includePaths(includePathsOptions) ]
};
