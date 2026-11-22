import * as stylex from "@stylexjs/stylex";
import { tokens } from "./tokens.stylex";

const DARK = "@media (prefers-color-scheme: dark)";

/** stylex.createTheme を用いて主要ブランドカラーを上書きするサンプルテーマ。 */
export const indigoBrandTheme = stylex.createTheme(tokens, {
  primary: { default: "#34499A", [DARK]: "#B6C4FF" },
  onPrimary: { default: "#FFFFFF", [DARK]: "#002682" },
  primaryContainer: { default: "#DCE1FF", [DARK]: "#1B3181" },
  onPrimaryContainer: { default: "#001453", [DARK]: "#DCE1FF" },
  secondary: { default: "#595E72", [DARK]: "#C2C5DD" },
  onSecondary: { default: "#FFFFFF", [DARK]: "#2B3042" },
  secondaryContainer: { default: "#DEE1F9", [DARK]: "#424659" },
  onSecondaryContainer: { default: "#161B2C", [DARK]: "#DEE1F9" },
});
