import * as stylex from "@stylexjs/stylex";

export const taskDeleteDialogStyles = stylex.create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
});
