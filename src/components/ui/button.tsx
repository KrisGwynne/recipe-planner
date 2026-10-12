import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  // The one main action on a screen.
  primary: "bg-primary hover:bg-primary-hover text-on-primary",
  secondary: "border border-line bg-surface hover:bg-surface-2",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "bg-danger text-on-danger",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Button classes, for links that look like buttons:
 * <Link className={buttonClasses("primary")} href="/import">.
 * Buttons are 48px tall (PP-145: tap targets of 44px or more).
 */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cx(
    "h-12 px-6 rounded-control font-semibold inline-flex items-center justify-center gap-2",
    "disabled:opacity-40 disabled:cursor-not-allowed",
    focus,
    variants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

/** A round 44px button holding just an icon. `label` is its accessible name. */
export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx("size-11 rounded-full border border-line grid place-items-center hover:bg-surface-2", focus, className)}
      {...props}
    />
  );
}
