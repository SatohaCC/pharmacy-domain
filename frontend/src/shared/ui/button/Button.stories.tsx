import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { Button, type ButtonVariant } from "./Button";
import { buttonStoryStyles as s } from "./Button.stories.styles";

const meta = {
  title: "shared/ui/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Refresh Status",
    variant: "filled",
    size: "md",
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};
export const Tonal: Story = { args: { variant: "tonal" } };
export const Outlined: Story = {
  args: {
    variant: "outlined",
    children: "Cancel",
  },
};
export const Text: Story = { args: { variant: "text" } };
export const Elevated: Story = { args: { variant: "elevated" } };

export const Small: Story = {
  args: {
    size: "sm",
    children: "Retry",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Checking...",
  },
};

export const DisabledText: Story = { args: { variant: "text", disabled: true } };
export const DisabledOutlined: Story = { args: { variant: "outlined", disabled: true } };

const variants = [
  { variant: "elevated", label: "Elevated" },
  { variant: "filled", label: "Filled" },
  { variant: "tonal", label: "Tonal" },
  { variant: "outlined", label: "Outlined" },
  { variant: "text", label: "Text" },
] as const satisfies readonly { variant: ButtonVariant; label: string }[];

export const Variants: Story = {
  name: "バリアント比較",
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div {...stylex.props(s.viewport)}>
      <table aria-label="ボタンのバリアントと状態の比較" {...stylex.props(s.table)}>
        <thead>
          <tr>
            <th scope="col" {...stylex.props(s.heading)}>
              サイズ・状態
            </th>
            {variants.map(({ variant, label }) => (
              <th key={variant} scope="col" {...stylex.props(s.heading)}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              { label: "標準", size: "md", disabled: false },
              { label: "小", size: "sm", disabled: false },
              { label: "無効", size: "md", disabled: true },
            ] as const
          ).map((row) => (
            <tr key={row.label}>
              <th scope="row" {...stylex.props(s.rowHeading)}>
                {row.label}
              </th>
              {variants.map(({ variant, label }) => (
                <td key={variant} {...stylex.props(s.cell)}>
                  <Button {...args} variant={variant} size={row.size} disabled={row.disabled}>
                    {label}
                  </Button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};
