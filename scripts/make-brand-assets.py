#!/usr/bin/env python3
"""ساخت دارایی‌های برند کیا: لوگو (دارک/لایت)، آیکون‌های PWA و تبدیل تصاویر به WebP."""
from PIL import Image, ImageDraw, ImageFont
import os, glob

IMG = "/home/user/modern-accessory/public/images"
os.makedirs(IMG, exist_ok=True)

# ---------- فونت ----------
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
font_path = next((p for p in FONT_PATHS if os.path.exists(p)), None)
print("font:", font_path)

LIME = (213, 241, 124, 255)      # --accent
CREAM = (243, 243, 235, 255)     # متن تم تاریک
INK = (23, 23, 23, 255)          # متن تم روشن
DARK_BG = (18, 20, 16, 255)      # --bg

def make_logo(name, text_color):
    """لوگوی تایپی KIYA با فاصله‌گذاری موسع — خروجی PNG با پس‌زمینهٔ شفاف."""
    W, H = 472, 360                       # ۴× اندازهٔ نمایش (۱۱۸×۹۰)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    word = "KIYA"
    font = ImageFont.truetype(font_path, 150) if font_path else ImageFont.load_default()
    # عرض کل با فاصلهٔ حروف
    spacing = 14
    widths = [d.textlength(ch, font=font) for ch in word]
    total = sum(widths) + spacing * (len(word) - 1)
    x = (W - total) / 2
    y = (H - 150) / 2 - 8
    for ch, w in zip(word, widths):
        d.text((x, y), ch, font=font, fill=text_color)
        x += w + spacing
    # نقطهٔ lime زیر wordmark (امضای برند)
    r = 13
    d.ellipse([W/2 - r, y + 168, W/2 + r, y + 168 + 2*r], fill=LIME)
    img.save(f"{IMG}/{name}")
    print("saved", name)

def make_icon(size, name):
    """آیکون PWA: پس‌زمینهٔ تیره + مارک سگک کمربند به رنگ lime."""
    img = Image.new("RGBA", (size, size), DARK_BG)
    d = ImageDraw.Draw(img)
    s = size
    # سگک (مستطیل گرد)
    bw, bh = s * 0.52, s * 0.34
    bx, by = (s - bw) / 2, (s - bh) / 2
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=s * 0.07, outline=LIME, width=int(s * 0.035))
    # میلهٔ عمودی داخل سگک
    d.line([s/2, by + s*0.05, s/2, by + bh - s*0.05], fill=LIME, width=int(s * 0.035))
    # کمربند (دو خط افقی از کنار سگک)
    d.line([s * 0.12, by + bh * 0.32, bx, by + bh * 0.32], fill=LIME, width=int(s * 0.05))
    d.line([bx + bw, by + bh * 0.68, s * 0.88, by + bh * 0.68], fill=LIME, width=int(s * 0.05))
    img.save(f"{IMG}/{name}")
    print("saved", name)

def to_webp(src, dst, size):
    img = Image.open(src).convert("RGB")
    # برش به نسبت هدف (cover)
    tw, th = size
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    img = img.resize((int(sw * scale + 0.5), int(sh * scale + 0.5)), Image.LANCZOS)
    sw, sh = img.size
    left, top = (sw - tw) // 2, (sh - th) // 2
    img = img.crop((left, top, left + tw, top + th))
    img.save(dst, "WEBP", quality=84, method=6)
    print("saved", dst, img.size)

# ---------- اجرا ----------
make_logo("logo.png", CREAM)          # برای تم تاریک (متن روشن)
make_logo("logo-light.png", INK)      # برای تم روشن (متن تیره)
make_icon(192, "icon-192.png")
make_icon(512, "icon-512.png")

to_webp(f"{IMG}/hero-belt.jpg",     f"{IMG}/hero-belt.webp",     (1400, 934))
to_webp(f"{IMG}/hero-jewelry.jpg",  f"{IMG}/hero-jewelry.webp",  (700, 934))
for name in ["belt", "chain", "bracelet", "ring", "earrings", "gift"]:
    to_webp(f"{IMG}/product-{name}.jpg", f"{IMG}/product-{name}.webp", (500, 500))

# حذف jpg های میانی (webp نهایی کافی است)
for f in glob.glob(f"{IMG}/*.jpg"):
    os.remove(f)
    print("removed", os.path.basename(f))

print("\n✅ همهٔ دارایی‌های برند ساخته شدند")
for f in sorted(os.listdir(IMG)):
    print(f"  {f}  ({os.path.getsize(os.path.join(IMG, f))//1024} KB)")
