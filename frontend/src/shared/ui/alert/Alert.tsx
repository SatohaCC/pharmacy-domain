"use client";

import * as stylex from "@stylexjs/stylex";
import { Button as UiButton } from "@ui-sdk/react/button";
import type { ReactNode } from "react";
import { hasRenderableNode } from "../internal/hasRenderableNode";
import { alertStyles as s } from "./Alert.styles";

export type AlertTone = "info" | "success" | "warning" | "error";

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  role?: "alert" | "status";
  style?: stylex.StyleXStyles;
}

const TONE_ICONS: Record<AlertTone, ReactNode> = {
  success: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...stylex.props(s.icon)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...stylex.props(s.icon)}
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...stylex.props(s.icon)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...stylex.props(s.icon)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  ),
};

const DISMISS_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    {...stylex.props(s.dismissIcon)}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/** Material Design 3 準拠のインライン通知バナー。 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  dismissLabel = "閉じる",
  role,
  style,
}: AlertProps) {
  const resolvedRole = role ?? (tone === "error" || tone === "warning" ? "alert" : "status");
  const hasAction = hasRenderableNode(action);
  const hasControls = hasAction || onDismiss !== undefined;

  return (
    <div
      role={resolvedRole}
      aria-live={resolvedRole === "alert" ? "assertive" : "polite"}
      {...stylex.props(s.root, s[tone], style)}
    >
      <span aria-hidden="true" {...stylex.props(s.iconWrap)}>
        {TONE_ICONS[tone]}
      </span>
      <div {...stylex.props(s.body)}>
        {hasRenderableNode(title) ? <div {...stylex.props(s.title)}>{title}</div> : null}
        <div {...stylex.props(s.message)}>{children}</div>
      </div>
      {hasControls ? (
        <div {...stylex.props(s.controls)}>
          {action}
          {onDismiss ? (
            <UiButton
              type="button"
              aria-label={dismissLabel}
              onClick={onDismiss}
              {...stylex.props(s.dismissButton)}
            >
              {DISMISS_ICON}
            </UiButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
