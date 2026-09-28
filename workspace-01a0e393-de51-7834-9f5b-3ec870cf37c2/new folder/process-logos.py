#!/usr/bin/env python3
"""
پردازش لوگوی کیا:
- حذف پس‌زمینهٔ مشکی خالص (شفاف‌سازی با لبهٔ نرم)
- نسخهٔ تم تاریک (حروف سفید) و تم روشن (حروف تیره)
- برش به کادر محتوا + مقیاس‌های استاندارد
-favicon، آیکون لمسی و آیکون‌های PWA از مارک «K»
"""
from PIL import Image, ImageDraw, ImageFilter
import os, shutil

SRC_WHITE = "/home/user/uploads/file_000000001a848210be522d53a31fec9a.png"   # حروف سفید + طلایی
SRC_DARK  = "/home/user/uploads/file_000000009e2082109a1316afe92b6d4e.png"   # حروف تیره + طلایی

OUT_DIRS = [
    "/home/user/modern-accessory/public/images",   # ریپوی Next.js
    "/home/user/wordpress/brand",                  # بستهٔ وردپرس
]
DARK_BG = (18, 20, 16)      # --bg تم تاریک سایت

def luminance(p):
    return max(p[0], p[1], p[2])

def unmake_black(img, lo=6, hi=26):
    """مشکی را شفاف کن با لبهٔ نرم؛ رنگ‌ها را برای جلوگیری از حاشیهٔ تیره normalize کن."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = max(r, g, b)
            if lum <= lo:
                px[x, y] = (0, 0, 0, 0)
            elif lum < hi:
                alpha = (lum - lo) / (hi - lo)
                # normalize رنگ با آلفا برای حذف حاشیهٔ تیره
                nr = min(255, int(r / alpha)) if alpha > 0 else 0
                ng = min(255, int(g / alpha)) if alpha > 0 else 0
                nb = min(255, int(b / alpha)) if alpha > 0 else 0
                px[x, y] = (nr, ng, nb, int(alpha * 255))
    return img

def crop_content(img, pad=12):
    """برش به کادر محتوای غیرشفاف."""
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    return img.crop((l, t, r, b))

def fit(img, w, h):
    """مقیاس با حفظ نسبت تا جا شدن در کادر."""
    img = img.copy()
    img.thumbnail((w, h), Image.LANCZOS)
    return img

def on_dark_square(mark, size, bg=DARK_BG, ratio=0.72):
    """مارک روی مربع تیره (برای آیکون)."""
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    m = fit(mark, int(size * ratio), int(size * ratio))
    canvas.paste(m, ((size - m.width) // 2, (size - m.height) // 2), m)
    return canvas

def save(img, name, out_dirs):
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)
        img.save(os.path.join(d, name))
    print("✓", name, img.size)

# ---------- ۱. پردازش دو لوگوی اصلی ----------
logo_dark_theme = crop_content(unmake_black(Image.open(SRC_WHITE)))   # حروف سفید → برای پس‌زمینهٔ تیره
logo_light_theme = crop_content(unmake_black(Image.open(SRC_DARK)))   # حروف تیره → برای پس‌زمینهٔ روشن

# ---------- ۲. مارک K (قسمت چپ لوگو) برای آیکون ----------
w, h = logo_dark_theme.size
mark = logo_dark_theme.crop((0, 0, int(w * 0.26), h))

for d in OUT_DIRS:
    os.makedirs(d, exist_ok=True)

# ---------- ۳. خروجی‌ها ----------
# لوگوهای اصلی (ارتفاع استاندارد ۲۰۰ پیکسل برای هدر)
for img, name, target_h in [
    (logo_dark_theme, "logo-dark.png", 200),
    (logo_light_theme, "logo-light.png", 200),
]:
    ratio = img.width / img.height
    resized = img.resize((int(target_h * ratio), target_h), Image.LANCZOS)
    save(resized, name, OUT_DIRS)

# favicon های مربعی از مارک K
for s in (16, 32, 48):
    save(fit(mark, s, s), f"favicon-{s}x{s}.png", OUT_DIRS)

# آیکون لمسی اپل (۱۸۰) — مارک روی مربع تیره
save(on_dark_square(mark, 180), "apple-touch-icon.png", OUT_DIRS)

# آیکون‌های PWA
for s in (192, 512):
    save(on_dark_square(mark, s), f"icon-{s}.png", OUT_DIRS)

# ---------- ۴. استخراج رنگ طلایی برند ----------
im = Image.open(SRC_WHITE).convert("RGB")
px = im.load()
golds = []
for y in range(0, im.height, 3):
    for x in range(0, im.width, 3):
        r, g, b = px[x, y]
        if r > 140 and 90 < g < 215 and b < 140 and (r - b) > 45 and not (r > 240 and g > 240):
            golds.append((r, g, b))
if golds:
    n = len(golds)
    avg = tuple(sum(c[i] for c in golds) // n for i in range(3))
    print("\n🎨 رنگ طلایی برند (میانگین): #%02x%02x%02x" % avg)
    golds.sort()
    print("   میانهٔ طلایی: #%02x%02x%02x" % golds[n // 2])

print("\n✅ پردازش لوگو کامل شد")
