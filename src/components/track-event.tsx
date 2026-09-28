"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/client-analytics";

/** فاز ۱۵ — ثبت رویداد بازدید هنگام mount صفحه (سرور رندر می‌ماند، فقط بیکن سبک) */
export function TrackEvent({ type, refValue }: { type: string; refValue: string }) {
  useEffect(() => { trackEvent(type, refValue); }, [type, refValue]);
  return null;
}
