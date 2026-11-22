const path = require("node:path");

/**
 * Next.js（Babel/PostCSS）と Vite（Storybook/Vitest）で共有する StyleX Babel プラグイン設定を生成する。
 */
function createStylexBabelPluginOptions({
  rootDir,
  dev = false,
  test = false,
  runtimeInjection = false,
  treeshakeCompensation = false,
}) {
  return {
    dev,
    test,
    runtimeInjection,
    ...(treeshakeCompensation ? { treeshakeCompensation: true } : {}),
    aliases: {
      "@/*": [path.join(rootDir, "src", "*").replaceAll("\\", "/")],
    },
    unstable_moduleResolution: {
      type: "commonJS",
      rootDir,
    },
  };
}

module.exports = { createStylexBabelPluginOptions };
