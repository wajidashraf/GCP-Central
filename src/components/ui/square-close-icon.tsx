import type { SVGProps } from "react";

type SquareCloseIconProps = SVGProps<SVGSVGElement>;

export default function SquareCloseIcon({ className, ...props }: SquareCloseIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ff5454"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
