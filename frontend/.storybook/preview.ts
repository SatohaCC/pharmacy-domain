import type { Preview } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { createElement } from "react";
import { previewStyles } from "./preview.styles";
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story) => createElement("div", stylex.props(previewStyles.surface), createElement(Story)),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
