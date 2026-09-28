import re

p = "src/app/api/admin/route.ts"
s = open(p, encoding="utf-8").read()

anchor = '''    } else if (body.action === "message.read") {'''

new_actions = '''    } else if (body.action === "slide.save") {
      const v = body.slide || {};
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\\/(?:images\\/[\\w.-]+|api\\/media\\/[a-f\\d-]{36})$/.test(image)) url(image);
      const link = text(v.link, 300) || "/shop";
      if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\\\")) throw new ValidationError("لینک بنر باید یک مسیر داخلی مانند /shop باشد.");
      const values = { eyebrow: text(v.eyebrow, 60), title: text(v.title, 40) || "استایل تو،", accent: text(v.accent, 40), description: text(v.description, 250), image, button: text(v.button, 35) || "مشاهده", link, label: text(v.label, 60), position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(heroSlides).set(values).where(eq(heroSlides.id, integer(v.id, 1)));
      else await db.insert(heroSlides).values(values);
    } else if (body.action === "slide.delete") {
      await db.delete(heroSlides).where(eq(heroSlides.id, integer(body.id, 1)));
    } else if (body.action === "flash.save") {
      const v = body.flash || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان فروش ویژه را وارد کنید.");
      const endsAt = new Date(String(v.endsAt));
      if (Number.isNaN(endsAt.getTime())) throw new ValidationError("زمان پایان فروش ویژه معتبر نیست.");
      const productIds = Array.isArray(v.productIds) ? [...new Set(v.productIds.map((id: unknown) => integer(id, 1)).filter(Boolean))].slice(0, 12) : [];
      if (!productIds.length) throw new ValidationError("حداقل یک محصول به فروش ویژه اضافه کنید.");
      const values = { title: text(v.title, 80), subtitle: text(v.subtitle, 200), productIds, endsAt, active: v.active !== false };
      if (v.id) await db.update(flashSales).set(values).where(eq(flashSales.id, integer(v.id, 1)));
      else await db.insert(flashSales).values(values);
    } else if (body.action === "flash.delete") {
      await db.delete(flashSales).where(eq(flashSales.id, integer(body.id, 1)));
    } else if (body.action === "trend.save") {
      const v = body.trend || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان ترند را وارد کنید.");
      const productIds = Array.isArray(v.productIds) ? [...new Set(v.productIds.map((id: unknown) => integer(id, 1)).filter(Boolean))].slice(0, 12) : [];
      const values = { title: text(v.title, 80), subtitle: text(v.subtitle, 200), productIds, position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(trends).set(values).where(eq(trends.id, integer(v.id, 1)));
      else await db.insert(trends).values(values);
    } else if (body.action === "trend.delete") {
      await db.delete(trends).where(eq(trends.id, integer(body.id, 1)));
    } else if (body.action === "look.save") {
      const v = body.look || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان ست را وارد کنید.");
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\\/(?:images\\/[\\w.-]+|api\\/media\\/[a-f\\d-]{36})$/.test(image)) url(image);
      const productIds = Array.isArray(v.productIds) ? [...new Set(v.productIds.map((id: unknown) => integer(id, 1)).filter(Boolean))].slice(0, 12) : [];
      if (!productIds.length) throw new ValidationError("حداقل یک محصول به ست اضافه کنید.");
      const values = { title: text(v.title, 80), description: text(v.description, 400), image, productIds, position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(looks).set(values).where(eq(looks.id, integer(v.id, 1)));
      else await db.insert(looks).values(values);
    } else if (body.action === "look.delete") {
      await db.delete(looks).where(eq(looks.id, integer(body.id, 1)));
    } else if (body.action === "review.approve") {
      await db.update(reviews).set({ approved: true }).where(eq(reviews.id, integer(body.id, 1)));
    } else if (body.action === "review.delete") {
      await db.delete(reviews).where(eq(reviews.id, integer(body.id, 1)));
    } else if (body.action === "question.save") {
      const answer = text(body.answer, 2000);
      if (!answer) throw new ValidationError("متن پاسخ را وارد کنید.");
      await db.update(questions).set({ answer, approved: true }).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "question.approve") {
      await db.update(questions).set({ approved: true }).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "question.delete") {
      await db.delete(questions).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "message.read") {'''

if anchor not in s:
    raise SystemExit("ANCHOR NOT FOUND")

s = s.replace(anchor, new_actions)
s = s.replace('revalidatePath("/"); revalidatePath("/shop");',
              'revalidatePath("/"); revalidatePath("/shop");')

open(p, "w", encoding="utf-8").write(s)
print("OK - actions added:", len(new_actions), "chars")
