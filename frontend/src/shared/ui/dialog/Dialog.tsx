"use client";

import * as stylex from "@stylexjs/stylex";
import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  type DialogContentProps,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Dialog as UiDialog,
  type DialogProps as UiDialogProps,
} from "@ui-sdk/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { type ButtonSize, type ButtonVariant, getButtonStyles } from "../internal/buttonStyles";
import { hasRenderableNode } from "../internal/hasRenderableNode";
import { dialogStyles as s } from "./Dialog.styles";

const CLOSE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    {...stylex.props(s.closeIcon)}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export type DialogRootProps = UiDialogProps;

/** ダイアログの状態と開閉コンテキストを管理するルートコンポーネント。 */
export function DialogRoot(props: DialogRootProps) {
  return <UiDialog {...props} />;
}

export interface DialogTriggerButtonProps
  extends Omit<ComponentProps<typeof DialogTrigger>, "className" | "style" | "render"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: stylex.StyleXStyles;
}

/** ダイアログを開く操作に使う M3 トリガーボタン。 */
export function DialogTriggerButton({
  variant = "filled",
  size = "md",
  disabled = false,
  style,
  children,
  ...props
}: DialogTriggerButtonProps) {
  return (
    <DialogTrigger
      disabled={disabled}
      {...stylex.props(getButtonStyles(variant, size, disabled), style)}
      {...props}
    >
      {children}
    </DialogTrigger>
  );
}

export interface DialogPanelProps
  extends Omit<ComponentProps<typeof DialogContent>, "className" | "style" | "render"> {
  style?: stylex.StyleXStyles;
}

/** 背景スクリムとダイアログ本体パネルを描画するコンポーネント。 */
export function DialogPanel({ style, children, ...props }: DialogPanelProps) {
  return (
    <>
      <DialogBackdrop className={stylex.props(s.backdrop).className} />
      <DialogContent {...stylex.props(s.content, style)} {...props}>
        {children}
      </DialogContent>
    </>
  );
}

export interface DialogSectionProps {
  children: ReactNode;
  style?: stylex.StyleXStyles;
}

/** ダイアログのヘッダー領域。 */
export function DialogHeader({ children, style }: DialogSectionProps) {
  return <div {...stylex.props(s.header, style)}>{children}</div>;
}

/** ダイアログヘッダー内のタイトルと補足説明を束ねるテキスト領域。 */
export function DialogHeaderText({ children, style }: DialogSectionProps) {
  return <div {...stylex.props(s.headerText, style)}>{children}</div>;
}

export interface DialogHeadingProps
  extends Omit<ComponentProps<typeof DialogTitle>, "className" | "style" | "render"> {
  style?: stylex.StyleXStyles;
}

/** ダイアログのアクセシブルなタイトル見出し。 */
export function DialogHeading({ style, ...props }: DialogHeadingProps) {
  return <DialogTitle {...stylex.props(s.title, style)} {...props} />;
}

export interface DialogSummaryProps
  extends Omit<ComponentProps<typeof DialogDescription>, "className" | "style" | "render"> {
  style?: stylex.StyleXStyles;
}

/** ダイアログのアクセシブルな補足説明。 */
export function DialogSummary({ style, ...props }: DialogSummaryProps) {
  return <DialogDescription {...stylex.props(s.description, style)} {...props} />;
}

export interface DialogCloseIconButtonProps
  extends Omit<ComponentProps<typeof DialogClose>, "className" | "style" | "render" | "children"> {
  label?: string;
  style?: stylex.StyleXStyles;
}

/** ダイアログ右上に配置する閉じるアイコンボタン。 */
export function DialogCloseIconButton({
  label = "閉じる",
  style,
  ...props
}: DialogCloseIconButtonProps) {
  return (
    <DialogClose aria-label={label} {...stylex.props(s.closeIconButton, style)} {...props}>
      {CLOSE_ICON}
    </DialogClose>
  );
}

/** ダイアログのスクロール可能な本文領域。 */
export function DialogBody({ children, style }: DialogSectionProps) {
  return <div {...stylex.props(s.body, style)}>{children}</div>;
}

/** ダイアログ下部のアクションボタン配置領域。 */
export function DialogActions({ children, style }: DialogSectionProps) {
  return <div {...stylex.props(s.actions, style)}>{children}</div>;
}

export interface DialogProps extends Omit<UiDialogProps, "children"> {
  title: string;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  closeLabel?: string;
  actions?: ReactNode;
  initialFocus?: DialogContentProps["initialFocus"];
  finalFocus?: DialogContentProps["finalFocus"];
  children?: ReactNode;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のダイアログ。 */
export function Dialog({
  title,
  description,
  triggerLabel,
  triggerVariant = "filled",
  closeLabel,
  actions,
  initialFocus,
  finalFocus,
  children,
  style,
  ...props
}: DialogProps) {
  return (
    <DialogRoot {...props}>
      {hasRenderableNode(triggerLabel) ? (
        <DialogTriggerButton variant={triggerVariant}>{triggerLabel}</DialogTriggerButton>
      ) : null}
      <DialogPanel initialFocus={initialFocus} finalFocus={finalFocus} style={style}>
        <DialogHeader>
          <DialogHeaderText>
            <DialogHeading>{title}</DialogHeading>
            {hasRenderableNode(description) ? <DialogSummary>{description}</DialogSummary> : null}
          </DialogHeaderText>
          {hasRenderableNode(closeLabel) ? <DialogCloseIconButton label={closeLabel} /> : null}
        </DialogHeader>
        {hasRenderableNode(children) ? <DialogBody>{children}</DialogBody> : null}
        {hasRenderableNode(actions) ? <DialogActions>{actions}</DialogActions> : null}
      </DialogPanel>
    </DialogRoot>
  );
}

export interface DialogCloseButtonProps
  extends Omit<ComponentProps<typeof DialogClose>, "className" | "style" | "render"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: stylex.StyleXStyles;
}

/** ダイアログを閉じる操作に使う M3 ボタン。 */
export function DialogCloseButton({
  variant = "text",
  size = "md",
  disabled = false,
  style,
  children,
  ...props
}: DialogCloseButtonProps) {
  return (
    <DialogClose
      disabled={disabled}
      {...stylex.props(getButtonStyles(variant, size, disabled), style)}
      {...props}
    >
      {children}
    </DialogClose>
  );
}
