"use client";

import * as stylex from "@stylexjs/stylex";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { SwitchThumb, Switch as UiSwitch } from "@ui-sdk/react/switch";
import type { ComponentProps } from "react";
import { mergeControlDescribedBy, useStandaloneField } from "../internal/useStandaloneField";
import { switchStyles as s } from "./Switch.styles";

export interface SwitchProps
  extends Omit<ComponentProps<typeof UiSwitch>, "className" | "style" | "children" | "render"> {
  label?: string;
  description?: string;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のスイッチ（設定の即時オン・オフ切り替え）。 */
export function Switch({
  label,
  description,
  disabled = false,
  style,
  "aria-describedby": describedBy,
  ...props
}: SwitchProps) {
  const { descId, hasFieldLayout, isInsideOuterFieldOnly, passStyleToControl, extraDescribedBy } =
    useStandaloneField({
      label,
      description,
      ariaDescribedBy: describedBy,
    });
  const control = (
    <UiSwitch
      disabled={disabled}
      style={stylex.props(passStyleToControl && style).style}
      className={(state) =>
        stylex.props(
          !state.disabled && stylex.defaultMarker(),
          s.track,
          state.checked ? s.trackChecked : s.trackUnchecked,
          state.disabled && (state.checked ? s.trackDisabledChecked : s.trackDisabledUnchecked),
          passStyleToControl && style,
        ).className
      }
      render={
        extraDescribedBy
          ? (controlProps) => (
              <button
                {...controlProps}
                aria-describedby={mergeControlDescribedBy(
                  controlProps["aria-describedby"],
                  extraDescribedBy,
                )}
              />
            )
          : undefined
      }
      {...props}
    >
      <SwitchThumb
        className={(state) =>
          stylex.props(
            s.thumb,
            state.checked ? s.thumbChecked : s.thumbUnchecked,
            state.disabled && (state.checked ? s.thumbDisabledChecked : s.thumbDisabledUnchecked),
          ).className
        }
      />
    </UiSwitch>
  );

  if (isInsideOuterFieldOnly) {
    return control;
  }

  return (
    <Field
      disabled={disabled}
      {...stylex.props(hasFieldLayout ? s.root : s.standaloneRoot, hasFieldLayout && style)}
    >
      <div {...stylex.props(hasFieldLayout ? s.field : s.standaloneField)}>
        {(label || description) && (
          <div {...stylex.props(s.textGroup)}>
            {label && (
              <FieldLabel
                className={(state) =>
                  stylex.props(s.label, state.disabled && s.labelDisabled).className
                }
              >
                {label}
              </FieldLabel>
            )}
            {description && (
              <p
                id={descId}
                data-slot="field-description"
                {...stylex.props(s.description, disabled && s.descriptionDisabled)}
              >
                {description}
              </p>
            )}
          </div>
        )}
        {control}
      </div>
      <FieldError className={stylex.props(s.error).className} />
    </Field>
  );
}
