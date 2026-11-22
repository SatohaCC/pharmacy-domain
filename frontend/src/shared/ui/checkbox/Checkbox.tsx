"use client";

import * as stylex from "@stylexjs/stylex";
import { CheckboxIndicator, Checkbox as UiCheckbox } from "@ui-sdk/react/checkbox";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import type { ComponentProps } from "react";
import { mergeControlDescribedBy, useStandaloneField } from "../internal/useStandaloneField";
import { checkboxStyles as s } from "./Checkbox.styles";

const INDETERMINATE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    aria-hidden="true"
    {...stylex.props(s.icon)}
  >
    <path d="M5 12h14" />
  </svg>
);

const CHECK_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...stylex.props(s.icon)}
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export interface CheckboxProps
  extends Omit<ComponentProps<typeof UiCheckbox>, "className" | "style" | "children" | "render"> {
  label?: string;
  description?: string;
  errorMessage?: string;
  invalid?: boolean;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のチェックボックス（選択・未選択・不確定に対応）。 */
export function Checkbox({
  label,
  description,
  errorMessage,
  invalid,
  disabled = false,
  style,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: CheckboxProps) {
  const {
    descId,
    errorId,
    isInvalid,
    showError,
    hasFieldLayout,
    isInsideOuterFieldOnly,
    passStyleToControl,
    extraDescribedBy,
  } = useStandaloneField({
    label,
    description,
    errorMessage,
    invalid,
    ariaDescribedBy: describedBy,
  });

  const control = (
    <UiCheckbox
      disabled={disabled}
      aria-invalid={isInsideOuterFieldOnly ? (isInvalid ?? ariaInvalid) : ariaInvalid}
      style={stylex.props(passStyleToControl && style).style}
      className={(state) => {
        const active = state.checked || state.indeterminate;
        return stylex.props(
          s.control,
          active && s.controlChecked,
          isInvalid && s.controlInvalid,
          state.disabled && s.controlDisabled,
          passStyleToControl && style,
        ).className;
      }}
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
      {(state) => {
        const active = state.checked || state.indeterminate;
        return (
          <span
            {...stylex.props(
              s.box,
              active && s.boxChecked,
              isInvalid && (active ? s.boxInvalidChecked : s.boxInvalid),
              state.disabled && (active ? s.boxDisabledChecked : s.boxDisabledUnchecked),
            )}
          >
            <CheckboxIndicator className={stylex.props(s.indicator).className}>
              {(indicatorState) => (indicatorState.indeterminate ? INDETERMINATE_ICON : CHECK_ICON)}
            </CheckboxIndicator>
          </span>
        );
      }}
    </UiCheckbox>
  );

  if (isInsideOuterFieldOnly) {
    return control;
  }

  return (
    <Field
      disabled={disabled}
      invalid={isInvalid}
      {...stylex.props(hasFieldLayout ? s.root : s.standaloneRoot, hasFieldLayout && style)}
    >
      <div {...stylex.props(hasFieldLayout ? s.row : s.standaloneRow)}>
        {control}
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
      </div>
      {showError ? (
        <div
          id={errorId}
          data-slot="field-error"
          {...stylex.props(s.error, !(label || description) && s.errorStandalone)}
        >
          {errorMessage}
        </div>
      ) : (
        <FieldError
          className={stylex.props(s.error, !(label || description) && s.errorStandalone).className}
        />
      )}
    </Field>
  );
}
