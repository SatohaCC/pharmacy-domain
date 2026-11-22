"use client";

import * as stylex from "@stylexjs/stylex";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
  Select as UiSelect,
  type SelectProps as UiSelectProps,
} from "@ui-sdk/react/select";
import { useMemo } from "react";
import { selectStyles as s } from "./Select.styles";

const CHEVRON_PATH = <path d="m6 9 6 6 6-6" />;

const CHECK_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...stylex.props(s.indicator)}
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectVariant = "outlined" | "filled";

export interface SelectProps {
  label: string;
  items: readonly SelectOption[];
  placeholder?: string;
  variant?: SelectVariant;
  description?: string;
  errorMessage?: string;
  invalid?: boolean;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: Extract<UiSelectProps<string, false>, { multiple?: false }>["onValueChange"];
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のセレクトメニュー（単一選択）。 */
export function Select({
  label,
  items,
  placeholder,
  variant = "outlined",
  description,
  errorMessage,
  invalid,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  readOnly = false,
  required = false,
  name,
  style,
}: SelectProps) {
  const isInvalid = invalid ?? (errorMessage ? true : undefined);
  const selectItems = useMemo(() => [...items], [items]);

  return (
    <Field name={name} disabled={disabled} invalid={isInvalid} {...stylex.props(s.root, style)}>
      <FieldLabel
        className={(state) =>
          stylex.props(s.label, state.invalid && s.labelInvalid, state.disabled && s.labelDisabled)
            .className
        }
      >
        {label}
        {required && (
          <span aria-hidden="true" {...stylex.props(s.requiredMark)}>
            *
          </span>
        )}
      </FieldLabel>
      <UiSelect
        items={selectItems}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
      >
        <SelectTrigger
          className={(state) =>
            stylex.props(
              s.trigger,
              variant === "outlined" ? s.outlined : s.filled,
              state.open && (variant === "outlined" ? s.outlinedOpen : s.filledOpen),
              isInvalid && (variant === "outlined" ? s.outlinedInvalid : s.filledInvalid),
              state.disabled && (variant === "outlined" ? s.outlinedDisabled : s.filledDisabled),
            ).className
          }
        >
          {(state) => (
            <>
              <SelectValue
                className={(valueState) =>
                  stylex.props(s.value, valueState.placeholder && s.valuePlaceholder).className
                }
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                {...stylex.props(
                  s.chevron,
                  state.open && s.chevronOpen,
                  state.disabled && s.chevronDisabled,
                )}
              >
                {CHEVRON_PATH}
              </svg>
            </>
          )}
        </SelectTrigger>
        <SelectContent sideOffset={4} className={stylex.props(s.content).className}>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              label={item.label}
              disabled={item.disabled}
              className={(state) =>
                stylex.props(
                  s.item,
                  state.highlighted && s.itemHighlighted,
                  state.selected && s.itemSelected,
                  state.disabled && s.itemDisabled,
                ).className
              }
            >
              <span>{item.label}</span>
              <SelectItemIndicator className={stylex.props(s.indicator).className}>
                {CHECK_ICON}
              </SelectItemIndicator>
            </SelectItem>
          ))}
        </SelectContent>
      </UiSelect>
      {description && (
        <FieldDescription
          className={(state) =>
            stylex.props(s.supporting, state.disabled && s.supportingDisabled).className
          }
        >
          {description}
        </FieldDescription>
      )}
      <FieldError className={stylex.props(s.error).className}>{errorMessage}</FieldError>
    </Field>
  );
}
