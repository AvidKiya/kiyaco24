"use client";
import type { CSSProperties, ElementType, ReactNode } from "react";

/* ============================================================
 *  فاز ۱ — سیستم «گوشهٔ معکوس کاربردی»
 *
 *  قانون طلایی: گوشهٔ تو‌رفته باید همیشه یک عنصر کارکردی بگیرد
 *  (CTA، فلش، بج تخفیف، میان‌بر دسته، لیبل ادیتوریال).
 *  اگر عنصری ندارد، تمیز بماند.
 *
 *  پیاده‌سازی با CSS mask → برش مقعر واقعی، مستقل از رنگ پس‌زمینه.
 * ============================================================ */

export type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type InvertedCornerProps = {
  /** گوشه‌ای که برش می‌خورد */
  position?: CornerPosition;
  /** قطر برش به پیکسل */
  size?: number;
  /** رنگ/تصویر پشت برش — فقط برای fallback مرورگرهای قدیمی */
  background?: string;
  /** عنصر کارکردی داخل برش (دکمه/بج/فلش) */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  "aria-label"?: string;
};

const centerFor = (position: CornerPosition, size: number): CSSProperties => {
  const half = size / 2;
  const horizontal = position.endsWith("left") ? { left: half } : { right: half };
  const vertical = position.startsWith("top") ? { top: half } : { bottom: half };
  return {
    position: "absolute",
    ...vertical,
    ...horizontal,
    transform: "translate(50%, -50%)",
    display: "grid",
    placeItems: "center",
    width: size,
    height: size,
    pointerEvents: "auto",
  };
};

export function InvertedCorner({
  position = "top-left",
  size = 34,
  background,
  children,
  className = "",
  style,
  as: Tag = "div",
  ...rest
}: InvertedCornerProps) {
  const gradient = `radial-gradient(circle ${size}px at var(--notch-x, 0%) var(--notch-y, 0%), transparent 97%, #000 100%)`;

  const cornerStyle: CSSProperties = {
    ["--notch-size" as string]: `${size}px`,
    ["--notch-x" as string]: position.endsWith("left") ? "0%" : "100%",
    ["--notch-y" as string]: position.startsWith("top") ? "0%" : "100%",
    maskImage: gradient,
    WebkitMaskImage: gradient,
    ...style,
  };

  return (
    <Tag className={`inverted-corner ${className}`.trim()} style={cornerStyle} {...rest}>
      {children ? (
        <span className="inverted-corner-slot" style={centerFor(position, size)} aria-hidden={!rest["aria-label"]}>
          {children}
        </span>
      ) : null}
    </Tag>
  );
}

/* ============================================================
 *  نسخهٔ سبک: فقط برش، بدون عنصر کارکردی
 *  (برای کارت‌هایی که نباید شلوغ شوند)
 * ============================================================ */
export function NotchOnly({ position = "bottom-left", size = 28, className = "", style }: { position?: CornerPosition; size?: number; className?: string; style?: CSSProperties }) {
  const gradient = `radial-gradient(circle ${size}px at var(--notch-x, 0%) var(--notch-y, 0%), transparent 97%, #000 100%)`;
  return (
    <span
      aria-hidden="true"
      className={`inverted-corner-notch ${className}`.trim()}
      style={{
        ["--notch-size" as string]: `${size}px`,
        ["--notch-x" as string]: position.endsWith("left") ? "0%" : "100%",
        ["--notch-y" as string]: position.startsWith("top") ? "0%" : "100%",
        maskImage: gradient,
        WebkitMaskImage: gradient,
        ...style,
      }}
    />
  );
}
