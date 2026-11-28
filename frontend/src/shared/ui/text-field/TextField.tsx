"use client";

import * as stylex from "@stylexjs/stylex";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input, InputGroup, type InputOptions } from "@ui-sdk/react/input";
import type { ComponentProps, ReactNode, Ref } from "react";
import { hasRenderableNode } from "../internal/hasRenderableNode";
import { textFieldStyles as s } from "./TextField.styles";

export type TextFieldVariant = "outlined" | "filled";

export interface TextFieldProps {
  label: string;
  variant?: TextFieldVariant;
  description?: string;
  errorMessage?: string;
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  name?: string;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  type?: ComponentProps<"input">["type"];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: InputOptions["onValueChange"];
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  enterKeyHint?: ComponentProps<"input">["enterKeyHint"];
  autoCapitalize?: ComponentProps<"input">["autoCapitalize"];
  autoCorrect?: "on" | "off";
  spellCheck?: ComponentProps<"input">["spellCheck"];
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠の単一行テキスト入力フィールド。 */
export function TextField({
  label,
  variant = "outlined",
  description,
  errorMessage,
  invalid,
  leading,
  trailing,
  name,
  id,
  inputRef,
  type = "text",
  placeholder,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  readOnly = false,
  required = false,
  maxLength,
  autoComplete,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  style,
}: TextFieldProps) {
  const isInvalid = invalid ?? (errorMessage ? true : undefined);

  return (
    <Field name={name} disabled={disabled} invalid={isInvalid} {...stylex.props(s.root, style)}>
      <FieldLabel
        className={(state) =>
          stylex.props(s.label, state.invalid && s.labelInvalid, state.disabled && s.labelDisabled)
            .className
        }
      >
        {label}
        {required ? (
          <span aria-hidden="true" {...stylex.props(s.requiredMark)}>
            *
          </span>
        ) : null}
      </FieldLabel>
      <InputGroup
        {...stylex.props(
          s.controlBox,
          variant === "outlined" ? s.outlined : s.filled,
          isInvalid && (variant === "outlined" ? s.outlinedInvalid : s.filledInvalid),
          disabled && (variant === "outlined" ? s.outlinedDisabled : s.filledDisabled),
        )}
      >
        {hasRenderableNode(leading) ? (
          <span {...stylex.props(s.affix, disabled && s.affixDisabled)}>{leading}</span>
        ) : null}
        <Input
          ref={inputRef}
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          className={(state) => stylex.props(s.input, state.disabled && s.inputDisabled).className}
        />
        {hasRenderableNode(trailing) ? (
          <span {...stylex.props(s.affix, disabled && s.affixDisabled)}>{trailing}</span>
        ) : null}
      </InputGroup>
      {hasRenderableNode(description) ? (
        <FieldDescription
          className={(state) =>
            stylex.props(s.supporting, state.disabled && s.supportingDisabled).className
          }
        >
          {description}
        </FieldDescription>
      ) : null}
      <FieldError className={stylex.props(s.error).className}>{errorMessage}</FieldError>
    </Field>
  );
}
