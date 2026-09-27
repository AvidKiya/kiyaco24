import re

p = "src/components/storefront.tsx"
s = open(p, encoding="utf-8").read()

# ۱) import ابزار مقایسه
s = s.replace('import { BeltSizeCalculator, ProductReviews, ProductQuestions, RecentlyViewed } from "./product-feedback";',
              'import { BeltSizeCalculator, ProductReviews, ProductQuestions, RecentlyViewed } from "./product-feedback";\nimport { useCompare, CompareBar, CompareModal } from "./compare";\nimport { Scale } from "lucide-react";')

# ۲) state های جدید در Catalog
old_state = '''  const [category, setCategory] = useState(initialCategory); const [query, setQuery] = useState(initialQuery); const [sort, setSort] = useState(initialSort); const [sale, setSale] = useState(initialSale); const [inStock, setInStock] = useState(false);
  const maximum = Math.max(1500000, ...products.map(p => p.price));
  const [maxPrice, setMaxPrice] = useState(maximum); const [mobileFilters, setMobileFilters] = useState(false);
  useEffect(() => { setCategory(initialCategory); setQuery(initialQuery); setSort(initialSort); setSale(initialSale); }, [initialCategory, initialQuery, initialSort, initialSale]);'''
new_state = '''  const [category, setCategory] = useState(initialCategory); const [query, setQuery] = useState(initialQuery); const [sort, setSort] = useState(initialSort); const [sale, setSale] = useState(initialSale); const [inStock, setInStock] = useState(false);
  const [colors, setColors] = useState<string[]>([]); const [sizes, setSizes] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const compare = useCompare();
  const maximum = Math.max(1500000, ...products.map(p => p.price));
  const [maxPrice, setMaxPrice] = useState(maximum); const [mobileFilters, setMobileFilters] = useState(false);
  // فهرست رنگ‌ها و سایزهای موجود در کاتالوگ (برای فیلتر)
  const allColors = [...new Map(products.flatMap(p => p.colors).map(c => [c.name, c])).values()];
  const allSizes = [...new Set(products.flatMap(p => p.sizes))].sort((a, b) => Number(a) - Number(b));
  const toggleIn = (list: string[], value: string, setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  useEffect(() => { setCategory(initialCategory); setQuery(initialQuery); setSort(initialSort); setSale(initialSale); }, [initialCategory, initialQuery, initialSort, initialSale]);'''
assert old_state in s
s = s.replace(old_state, new_state)

# ۳) منطق فیلتر + مرتب‌سازی جدید
old_filter = '''  const filtered = products.filter(p => (category === "all" || (category === "accessories" ? p.category !== "belts" : p.category === category)) && (!query || normalize(`${p.name} ${p.description}`).includes(normalize(query))) && (!sale || (p.compareAt && p.compareAt > p.price)) && (!inStock || p.stock > 0) && p.price <= maxPrice).sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "newest" ? b.id - a.id : Number(b.featured) - Number(a.featured));'''
new_filter = '''  const filtered = products.filter(p => (category === "all" || (category === "accessories" ? p.category !== "belts" : p.category === category)) && (!query || normalize(`${p.name} ${p.description}`).includes(normalize(query))) && (!sale || (p.compareAt && p.compareAt > p.price)) && (!inStock || p.stock > 0) && p.price <= maxPrice && (!colors.length || p.colors.some(c => colors.includes(c.name))) && (!sizes.length || p.sizes.some(size => sizes.includes(size)))).sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "newest" ? b.id - a.id : sort === "discount" ? discountPercent(b) - discountPercent(a) : Number(b.featured) - Number(a.featured));'''
assert old_filter in s
s = s.replace(old_filter, new_filter)

# ۴) reset باید فیلترهای جدید را هم پاک کند
s = s.replace('function reset() { setCategory("all"); setQuery(""); setSale(false); setInStock(false); setMaxPrice(maximum); }',
              'function reset() { setCategory("all"); setQuery(""); setSale(false); setInStock(false); setMaxPrice(maximum); setColors([]); setSizes([]); }')

# ۵) فیلترهای رنگ و سایز بعد از toggle-filters
old_toggles = '''<fieldset className="toggle-filters"><label><span>فقط محصولات موجود</span><input type="checkbox" role="switch" checked={inStock} onChange={e => setInStock(e.target.checked)} /></label><label><span>فقط تخفیف‌دارها</span><input type="checkbox" role="switch" checked={sale} onChange={e => setSale(e.target.checked)} /></label></fieldset>'''
new_toggles = old_toggles + '''
        <fieldset><legend>رنگ</legend><div className="chip-filters">{allColors.map(color => <button key={color.name} type="button" className={colors.includes(color.name) ? "filter-chip selected" : "filter-chip"} aria-pressed={colors.includes(color.name)} onClick={() => toggleIn(colors, color.name, setColors)}><span className="chip-dot" style={{ background: color.hex }} />{color.name}</button>)}</div></fieldset>
        <fieldset><legend>سایز</legend><div className="chip-filters">{allSizes.map(size => <button key={size} type="button" className={sizes.includes(size) ? "filter-chip selected" : "filter-chip"} aria-pressed={sizes.includes(size)} onClick={() => toggleIn(sizes, size, setSizes)}>{size}</button>)}</div></fieldset>'''
assert old_toggles in s
s = s.replace(old_toggles, new_toggles)

# ۶) گزینهٔ مرتب‌سازی «بیشترین تخفیف»
s = s.replace('<option value="price-desc">گران‌ترین</option></select>',
              '<option value="price-desc">گران‌ترین</option><option value="discount">بیشترین تخفیف</option></select>')

# ۷) چیپ‌های فیلتر فعال
old_active = '''{sale && <button onClick={() => setSale(false)}>تخفیف‌دار<X size={13} /></button>}</div>}'''
new_active = '''{sale && <button onClick={() => setSale(false)}>تخفیف‌دار<X size={13} /></button>}{colors.map(color => <button key={color} onClick={() => toggleIn(colors, color, setColors)}>{color}<X size={13} /></button>)}{sizes.map(size => <button key={size} onClick={() => toggleIn(sizes, size, setSizes)}>سایز {size}<X size={13} /></button>)}</div>}'''
assert old_active in s
s = s.replace(old_active, new_active)

# ۸) دکمهٔ مقایسه روی هر کارت + نوار و مودال مقایسه
old_grid = '''{filtered.length ? <div className="catalog-product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} onQuickView={quickView} />)}</div> : <EmptyState icon={<Search size={38} />} title="این‌بار چیزی پیدا نشد" text="یک دسته‌بندی یا محدودهٔ قیمت دیگه رو امتحان کن."><button className="button button-lime" onClick={reset}>نمایش همهٔ محصولات</button></EmptyState>}</section>'''
new_grid = '''{filtered.length ? <div className="catalog-product-grid">{filtered.map(p => <div className="catalog-card-wrap" key={p.id}><ProductCard product={p} onQuickView={quickView} /><button className={compare.has(p.id) ? "compare-toggle selected" : "compare-toggle"} aria-pressed={compare.has(p.id)} aria-label={`${compare.has(p.id) ? "حذف" : "افزودن"} ${p.name} از مقایسه`} onClick={() => { if (compare.toggle(p.id) === "limit") setCompareOpen(true); }}><Scale size={15} />{compare.has(p.id) ? "در مقایسه" : "مقایسه"}</button></div>)}</div> : <EmptyState icon={<Search size={38} />} title="این‌بار چیزی پیدا نشد" text="یک دسته‌بندی یا محدودهٔ قیمت دیگه رو امتحان کن."><button className="button button-lime" onClick={reset}>نمایش همهٔ محصولات</button></EmptyState>}</section>
      <CompareBar items={compare.items} products={products} onOpen={() => setCompareOpen(true)} onClear={compare.clear} />
      {compareOpen && <CompareModal items={compare.items} products={products} onClose={() => setCompareOpen(false)} onRemove={compare.remove} />}'''
assert old_grid in s
s = s.replace(old_grid, new_grid)

open(p, "w", encoding="utf-8").write(s)
print("✅ Catalog با فیلتر رنگ/سایز + مقایسه گسترش یافت")
