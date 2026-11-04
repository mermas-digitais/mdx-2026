"use client";

import { Input } from "@/components/ui/input";

export const inscriptionInputClass =
  "h-14 w-full rounded-full border-0 bg-white px-5 text-base text-[#330043] shadow-[0_10px_28px_rgba(88,28,135,0.08)] ring-1 ring-[#F6E9FF] placeholder:text-[#C4B5D4] focus-visible:ring-2 focus-visible:ring-[#FF4A97] md:text-base";

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function CpfField({
  id,
  value,
  onChange,
  readOnly = false,
  invalid = false,
  required = false,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <Input
      id={id}
      value={formatCpf(value)}
      onChange={(item) => onChange(formatCpf(item.target.value))}
      inputMode="numeric"
      autoComplete="off"
      placeholder="000.000.000-00"
      maxLength={14}
      readOnly={readOnly}
      required={required}
      aria-invalid={invalid || undefined}
      className={className ?? inscriptionInputClass}
    />
  );
}

export function PhoneField({
  id,
  value,
  onChange,
  invalid = false,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <Input
      id={id}
      value={formatPhone(value)}
      onChange={(item) => onChange(formatPhone(item.target.value))}
      inputMode="numeric"
      autoComplete="tel"
      placeholder="(99) 99999-9999"
      maxLength={16}
      aria-invalid={invalid || undefined}
      className={className ?? inscriptionInputClass}
    />
  );
}
