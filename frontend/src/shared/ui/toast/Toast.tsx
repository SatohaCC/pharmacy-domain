"use client";

import * as stylex from "@stylexjs/stylex";
import {
  createToaster,
  type Toaster,
  type ToastOptions,
  type ToastType,
  toast,
  Toast as UiToast,
  ToastAction as UiToastAction,
  ToastClose as UiToastClose,
  ToastDescription as UiToastDescription,
  ToastRegion as UiToastRegion,
  ToastTitle as UiToastTitle,
} from "@ui-sdk/react/toast";
import { type CSSProperties, cloneElement, isValidElement, type ReactNode } from "react";
import { toastStyles as s } from "./Toast.styles";

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

export type { Toaster, ToastOptions, ToastType };
export { createToaster, toast };

export type ToastSide = "top" | "bottom";
export type ToastAlign = "start" | "center" | "end";

export interface ToastViewportProps {
  toaster?: Toaster<ReactNode>;
  side?: ToastSide;
  align?: ToastAlign;
  maxVisible?: number;
  shortcut?: string | null;
  "aria-label"?: string;
  closeLabel?: string;
  style?: stylex.StyleXStyles;
}

type ToastListElementProps = {
  className?: string;
  style?: CSSProperties;
};

function getToneStyle(type: ToastType) {
  if (type === "success") return s.toneSuccess;
  if (type === "info") return s.toneInfo;
  if (type === "warning") return s.toneWarning;
  if (type === "error") return s.toneError;
  return s.toneDefault;
}

/** Material Design 3 準拠のトースト通知表示領域。 */
export function ToastViewport({
  toaster,
  side = "bottom",
  align = "end",
  maxVisible = 3,
  shortcut,
  "aria-label": ariaLabel = "通知",
  closeLabel = "通知を閉じる",
  style,
}: ToastViewportProps) {
  const alignStyle =
    align === "start" ? s.alignStart : align === "center" ? s.alignCenter : s.alignEnd;
  const listStyleProps = stylex.props(s.list, side === "top" ? s.listTop : s.listBottom);

  return (
    <UiToastRegion
      toaster={toaster}
      side={side}
      align={align}
      maxVisible={maxVisible}
      // 重なり畳み用スタイルは未実装のため常時展開レイアウトに固定する。
      expanded
      shortcut={shortcut}
      aria-label={ariaLabel}
      {...stylex.props(s.region, side === "top" ? s.regionTop : s.regionBottom, alignStyle, style)}
      render={({ children: listNode, ...regionProps }) => {
        const styledList = isValidElement<ToastListElementProps>(listNode)
          ? cloneElement(listNode, {
              className: [listNode.props.className, listStyleProps.className]
                .filter(Boolean)
                .join(" "),
              style:
                listNode.props.style || listStyleProps.style
                  ? { ...listNode.props.style, ...listStyleProps.style }
                  : undefined,
            })
          : listNode;
        return <section {...regionProps}>{styledList}</section>;
      }}
    >
      {(toastData) => {
        const isInverse = toastData.type === "default" || toastData.type === "loading";
        return (
          <UiToast
            className={(state) =>
              stylex.props(s.toast, getToneStyle(state.type), state.leaving && s.toastLeaving)
                .className
            }
          >
            <div {...stylex.props(s.body)}>
              <UiToastTitle className={stylex.props(s.title).className} />
              <UiToastDescription className={stylex.props(s.description).className} />
            </div>
            <div {...stylex.props(s.actions)}>
              {toastData.action && (
                <UiToastAction
                  className={
                    stylex.props(
                      s.actionButton,
                      isInverse && s.actionInverse,
                      isInverse && s.buttonFocusInverse,
                    ).className
                  }
                />
              )}
              {toastData.dismissible !== false && (
                <UiToastClose
                  aria-label={closeLabel}
                  className={
                    stylex.props(s.closeButton, isInverse && s.buttonFocusInverse).className
                  }
                >
                  {CLOSE_ICON}
                </UiToastClose>
              )}
            </div>
          </UiToast>
        );
      }}
    </UiToastRegion>
  );
}
