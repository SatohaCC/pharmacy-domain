import { useFieldControl } from "@ui-sdk/react/field";
import { useId } from "react";
import { mergeDescribedBy } from "./mergeDescribedBy";

export interface StandaloneFieldOptions {
  label?: string;
  description?: string;
  errorMessage?: string;
  invalid?: boolean;
  ariaDescribedBy?: string;
}

/** 外部 Field 判定・検証状態・aria-describedby 合成をフォーム部品間で共通化するフック。 */
export function useStandaloneField({
  label,
  description,
  errorMessage,
  invalid,
  ariaDescribedBy,
}: StandaloneFieldOptions) {
  const outerField = useFieldControl();
  const baseId = useId();
  const descId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const isInvalid = invalid ?? (errorMessage ? true : undefined);
  const showError = Boolean(errorMessage) && isInvalid !== false;
  const hasFieldLayout = Boolean(label || description || showError);
  const hasOuterField = Boolean(outerField);
  const outerFieldDisabled = Boolean(outerField?.disabled);
  const isInsideOuterFieldOnly = hasOuterField && !hasFieldLayout;
  const passStyleToControl = hasOuterField || !hasFieldLayout;
  const extraDescribedBy = mergeDescribedBy(
    ariaDescribedBy,
    description ? descId : undefined,
    showError ? errorId : undefined,
  );

  return {
    baseId,
    descId,
    errorId,
    isInvalid,
    showError,
    hasFieldLayout,
    hasOuterField,
    outerFieldDisabled,
    isInsideOuterFieldOnly,
    passStyleToControl,
    extraDescribedBy,
  };
}

/** render prop の props に追加の aria-describedby を重複なく合成する。 */
export function mergeControlDescribedBy(
  controlDescribedBy: unknown,
  extraDescribedBy: string | undefined,
): string | undefined {
  return mergeDescribedBy(
    typeof controlDescribedBy === "string" ? controlDescribedBy : undefined,
    extraDescribedBy,
  );
}
