import * as stylex from "@stylexjs/stylex";

export const taskEditDialogStyles = stylex.create({
  bodyStack: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  confirmActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "0.75rem",
    paddingTop: "0.5rem",
  },
});
