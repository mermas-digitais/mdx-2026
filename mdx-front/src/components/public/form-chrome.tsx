"use client";

import { useRef } from "react";

export function StepHeading({
  step,
  total,
  kicker,
  title,
}: {
  step: number;
  total: number;
  kicker: string;
  title: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-[#8B7C99] uppercase">Passo {step} de {total}</p>
      <p className="mt-3 text-sm font-bold tracking-widest text-[#FF4A97] uppercase">{kicker}</p>
      <h2 className="mt-1 font-heading text-3xl leading-tight text-[#330043]">{title}</h2>
    </div>
  );
}

export function GradientButton({
  children,
  type = "button",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-full bg-gradient-to-r from-[#FF4A97] to-[#FFB347] text-base font-bold text-white shadow-[0_10px_24px_rgba(255,74,151,0.28)] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function CodeBoxes({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  function write(next: string) {
    onChange(next.replace(/\D/g, "").slice(0, 6));
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Dígito ${index + 1} do código`}
          maxLength={1}
          className="size-12 rounded-full bg-white text-center text-xl font-bold text-[#330043] shadow-[0_8px_20px_rgba(88,28,135,0.1)] ring-1 ring-[#F6E9FF] outline-none focus:ring-2 focus:ring-[#FF4A97]"
          onChange={(event) => {
            const incoming = event.target.value.replace(/\D/g, "");
            if (incoming.length > 1) {
              write(incoming);
              refs.current[Math.min(5, incoming.length)]?.focus();
              return;
            }
            const next = digits.map((item, itemIndex) => (itemIndex === index ? incoming : item)).join("");
            write(next);
            if (incoming && index < 5) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            write(event.clipboardData.getData("text"));
            refs.current[5]?.focus();
          }}
        />
      ))}
    </div>
  );
}
