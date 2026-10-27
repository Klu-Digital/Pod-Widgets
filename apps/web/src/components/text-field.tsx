import {
  Field,
  FieldError,
  FieldLabel,
} from "@trumpet-pods/ui/components/field";
import { Input } from "@trumpet-pods/ui/components/input";
import type { InputProps } from "@trumpet-pods/ui/components/input";
import { useId } from "react";
import type { ReactNode } from "react";

export const TextField = ({
  error,
  id,
  label,
  ...props
}: Omit<InputProps, "aria-describedby" | "aria-invalid" | "id"> & {
  error?: string;
  id?: string;
  label: ReactNode;
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <Field invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        id={inputId}
        {...props}
      />
      {error ? (
        <FieldError id={errorId} match>
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
};
