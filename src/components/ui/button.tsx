'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg' | 'xl';

interface BaseButtonProps {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  iconOnly?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// When href is provided it renders a <Link>, otherwise a <button>
type ButtonAsLink   = BaseButtonProps & { href: string }  & { disabled?: never };
type ButtonAsButton = BaseButtonProps & { href?: never }   & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonProps = ButtonAsLink | ButtonAsButton;

// ─── Class builders ────────────────────────────────────────────
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:   'btn btn--primary',
  secondary: 'btn btn--secondary',
  ghost:     'btn btn--ghost',
  accent:    'btn btn--accent',
  danger:    'btn btn--danger',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
  xl: 'btn--xl',
};

function buildClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  loading: boolean,
  iconOnly: boolean,
  extra?: string
): string {
  return [
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    loading  ? 'btn--loading' : '',
    iconOnly ? 'btn--icon'    : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

// ─── Component ────────────────────────────────────────────────
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant  = 'primary',
    size     = 'md',
    loading  = false,
    iconOnly = false,
    className,
    children,
    ...rest
  },
  ref
) {
  const classes = buildClasses(variant, size, loading, iconOnly, className);

  // Render as <Link> when href is supplied
  if ('href' in rest && rest.href) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...(linkRest as object)}>
        {loading && <span className="btn__spinner" aria-hidden="true" />}
        {children}
      </Link>
    );
  }

  // Render as <button>
  const { disabled, ...btnRest } = rest as ButtonAsButton;
  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...btnRest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
