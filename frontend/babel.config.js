const { createStylexBabelPluginOptions } = require("./config/stylexBabelOptions.cjs");

module.exports = {
  presets: ["next/babel"],
  plugins: [
    [
      "@stylexjs/babel-plugin",
      createStylexBabelPluginOptions({
        rootDir: __dirname,
        dev: process.env.NODE_ENV === "development",
        test: process.env.NODE_ENV === "test",
        runtimeInjection: false,
        treeshakeCompensation: true,
      }),
    ],
  ],
};
