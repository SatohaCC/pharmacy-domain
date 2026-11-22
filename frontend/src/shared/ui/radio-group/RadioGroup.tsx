"use client";

import * as stylex from "@stylexjs/stylex";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import {
  Radio,
  type RadioGroupOptions,
  RadioIndicator,
  RadioGroup as UiRadioGroup,
} from "@ui-sdk/react/radio";
import { mergeControlDescribedBy, useStandaloneField } from "../internal/useStandaloneField";
import { radioGroupStyles as s } from "./RadioGroup.styles";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  items: readonly RadioOption[];
  label?: string;
  description?: string;
  errorMessage?: string;
  invalid?: boolean;
  orientation?: "vertical" | "horizontal";
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: RadioGroupOptions<string>["onValueChange"];
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  loop?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のラジオボタングループ（単一選択）。 */
export function RadioGroup({
  items,
  label,
  description,
  errorMessage,
  invalid,
  orientation = "vertical",
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  readOnly = false,
  required = false,
  name,
  loop = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  style,
}: RadioGroupProps) {
  const {
    baseId,
    descId,
    errorId,
    isInvalid,
    showError,
    hasFieldLayout,
    isInsideOuterFieldOnly,
    passStyleToControl: passStyleToGroup,
    extraDescribedBy,
  } = useStandaloneField({
    label,
    description,
    errorMessage,
    invalid,
    ariaDescribedBy,
  });

  const group = (
    <UiRadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      name={name}
      loop={loop}
      aria-label={!label ? ariaLabel : undefined}
      aria-labelledby={!label ? ariaLabelledBy : undefined}
      aria-invalid={isInsideOuterFieldOnly ? (isInvalid ?? undefined) : undefined}
      render={
        extraDescribedBy
          ? (groupProps) => (
              <div
                {...groupProps}
                aria-describedby={mergeControlDescribedBy(
                  groupProps["aria-describedby"],
                  extraDescribedBy,
                )}
              />
            )
          : undefined
      }
      {...stylex.props(
        s.list,
        orientation === "horizontal" && s.listHorizontal,
        passStyleToGroup && style,
      )}
    >
      {items.map((item, index) => {
        const itemDisabled = disabled || Boolean(item.disabled);
        const radioId = `${baseId}-radio-${index}`;
        const descId = `${baseId}-desc-${index}`;
        return (
          <div key={item.value} {...stylex.props(s.itemField)}>
            <Radio
              id={radioId}
              value={item.value}
              disabled={itemDisabled}
              aria-describedby={item.description ? descId : undefined}
              aria-invalid={isInvalid ? true : undefined}
              className={(state) =>
                stylex.props(
                  s.control,
                  state.checked && s.controlChecked,
                  isInvalid && s.controlInvalid,
                  state.disabled && s.controlDisabled,
                ).className
              }
            >
              {(state) => (
                <span
                  {...stylex.props(
                    s.ring,
                    state.checked && s.ringChecked,
                    isInvalid && s.ringInvalid,
                    state.disabled && s.ringDisabled,
                  )}
                >
                  <RadioIndicator
                    className={(indicatorState) =>
                      stylex.props(
                        s.dot,
                        isInvalid && s.dotInvalid,
                        indicatorState.disabled && s.dotDisabled,
                      ).className
                    }
                  />
                </span>
              )}
            </Radio>
            <div {...stylex.props(s.textGroup)}>
              <label
                htmlFor={radioId}
                {...stylex.props(s.itemLabel, itemDisabled && s.itemLabelDisabled)}
              >
                {item.label}
              </label>
              {item.description && (
                <p
                  id={descId}
                  {...stylex.props(s.itemDescription, itemDisabled && s.itemDescriptionDisabled)}
                >
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </UiRadioGroup>
  );

  if (isInsideOuterFieldOnly) {
    return group;
  }

  return (
    <Field
      name={name}
      disabled={disabled}
      invalid={isInvalid}
      {...stylex.props(hasFieldLayout ? s.root : s.standaloneRoot, hasFieldLayout && style)}
    >
      {label && (
        <FieldLabel
          className={(state) =>
            stylex.props(
              s.groupLabel,
              state.invalid && s.groupLabelInvalid,
              state.disabled && s.groupLabelDisabled,
            ).className
          }
        >
          {label}
          {required && (
            <span aria-hidden="true" {...stylex.props(s.requiredMark)}>
              *
            </span>
          )}
        </FieldLabel>
      )}
      {description && (
        <p
          id={descId}
          data-slot="field-description"
          {...stylex.props(s.supporting, disabled && s.supportingDisabled)}
        >
          {description}
        </p>
      )}
      {group}
      {showError ? (
        <div id={errorId} data-slot="field-error" {...stylex.props(s.error)}>
          {errorMessage}
        </div>
      ) : (
        <FieldError className={stylex.props(s.error).className} />
      )}
    </Field>
  );
}
