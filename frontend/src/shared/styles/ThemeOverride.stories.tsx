import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Switch } from "@/shared/ui/switch/Switch";
import { indigoBrandTheme } from "./brandTheme";
import { themeOverrideStoryStyles as s } from "./ThemeOverride.stories.styles";

function ThemePanel({ title, theme }: { title: string; theme?: typeof indigoBrandTheme }) {
  return (
    <section {...stylex.props(s.panel, theme)}>
      <h2 {...stylex.props(s.heading)}>{title}</h2>
      <div {...stylex.props(s.row)}>
        <Button variant="filled">保存する</Button>
        <Button variant="tonal">下書き</Button>
        <Button variant="outlined">キャンセル</Button>
      </div>
      <div {...stylex.props(s.row)}>
        <Badge tone="neutral">標準</Badge>
        <Badge tone="success">有効</Badge>
        <Switch label="通知を有効にする" defaultChecked />
      </div>
    </section>
  );
}

function ThemeComparisonShowcase() {
  return (
    <div {...stylex.props(s.grid)}>
      <ThemePanel title="デフォルトテーマ" />
      <ThemePanel title="ブランド差し替え例（indigoBrandTheme）" theme={indigoBrandTheme} />
    </div>
  );
}

const meta = {
  title: "shared/styles/ThemeOverride",
  component: ThemeComparisonShowcase,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeComparisonShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandThemeComparison: Story = {};
