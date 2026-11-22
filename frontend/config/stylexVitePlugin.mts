import { createRequire } from "node:module";
import { transformAsync } from "@babel/core";

const require = createRequire(import.meta.url);
const { createStylexBabelPluginOptions } = require("./stylexBabelOptions.cjs") as {
  createStylexBabelPluginOptions: (options: {
    rootDir: string;
    dev?: boolean;
    test?: boolean;
    runtimeInjection?: boolean;
    treeshakeCompensation?: boolean;
  }) => Record<string, unknown>;
};

export function stylexVitePlugin({ rootDir, test = false }: { rootDir: string; test?: boolean }) {
  return {
    name: "stylex-transform",
    enforce: "pre" as const,
    async transform(code: string, id: string) {
      const filename = id.split("?")[0];
      if (
        !/\.[jt]sx?$/.test(filename) ||
        filename.includes("node_modules") ||
        !code.includes("@stylexjs/stylex")
      ) {
        return null;
      }

      const result = await transformAsync(code, {
        filename,
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [
          [
            "@stylexjs/babel-plugin",
            createStylexBabelPluginOptions({
              rootDir,
              dev: false,
              test,
              runtimeInjection: true,
            }),
          ],
        ],
      });
      return result ? { code: result.code ?? code, map: null } : null;
    },
  };
}
