/**
 * Minimal self-contained icon set (no external dependency). Each icon is a stroke
 * SVG that inherits the surrounding text color via `currentColor`, so it can be
 * dropped inline next to button/label text and sized with the `size` prop.
 */
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}

function base(size: number): React.SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { flexShrink: 0, verticalAlign: "text-bottom" },
  };
}

export function PlayIcon({ size = 14, style }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none" style={{ ...base(size).style, ...style }}>
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  );
}

export function FileTextIcon({ size = 16, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

export function AlertIcon({ size = 14, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function CopyIcon({ size = 14, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon({ size = 14, strokeWidth = 2.4, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CloseIcon({ size = 14, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function LinkIcon({ size = 14, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 12, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} style={{ ...base(size).style, ...style }}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
