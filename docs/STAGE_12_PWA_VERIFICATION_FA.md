# مرحله ۱۲ — تکمیل و اعتبارسنجی PWA

تاریخ بررسی: ۲۵ ژوئیه ۲۰۲۶

## پیاده‌سازی

- `public/manifest.webmanifest` با نام کامل/کوتاه، `start_url=/`،
  `scope=/`، حالت `standalone`، رنگ‌های واقعی و جهت RTL اضافه شد.
- آیکون‌های واقعی و غیر-placeholder برای ۱۹۲، ۵۱۲، maskable ۵۱۲ و Apple
  Touch Icon ۱۸۰ ساخته شدند. ابعاد و محتوای PNGها در تست کنترل می‌شود.
- `public/index.html` قالب واقعی Expo است و لینک manifest، favicon،
  `apple-touch-icon`، `apple-mobile-web-app-capable`، عنوان iOS و وضعیت
  status bar را در HTML اولیه قرار می‌دهد.
- `public/sw.js` و `scripts/prepare-pwa-output.mjs` همه فایل‌های shell ساخته‌شده
  شامل HTML، JavaScript هش‌شده، فونت‌ها و assetهای Expo را precache می‌کنند.
- شناسه cache از محتوای واقعی خروجی ساخته می‌شود؛ با تغییر build، cache قبلی
  در activate حذف می‌شود.
- navigation در حالت آفلاین به `index.html` cache‌شده برمی‌گردد.
- `/app-config.json` در precache قرار نمی‌گیرد و service worker برای آن فقط
  `fetch` با `cache: no-store` اجرا می‌کند. در حالت آفلاین، کد اپ به fallback
  داخلی برمی‌گردد.
- برای DirectAdmin/Apache، Netlify و Vercel هدر `no-store` تنظیمات و
  `no-cache` فایل service worker ثبت شده است.

## نتیجه تست‌های خودکار

| تست | نتیجه | چیزی که بررسی شد |
| --- | --- | --- |
| `npm run build:web` | PASS | خروجی Expo، تزریق precache، کپی byte-for-byte تنظیمات |
| `npm run test:pwa` | PASS | manifest، start/scope، متاتگ‌ها، فایل‌ها و ابعاد واقعی آیکون‌ها |
| `npm run test:pwa-offline` | PASS | install/activate، cache شدن bundle Expo، اجرای navigation بدون شبکه |
| کنترل `app-config.json` | PASS | نبودن در app shell و درخواست network-only با `no-store` |
| `npm run check` | PASS | ۲۸/۲۸ کنترل امنیت/local-first، TypeScript و همه smoke testهای وب |

فهرست precache همه URLهای shell را از خروجی واقعی build تولید می‌کند؛ bundle
اصلی وب `/_expo/static/js/web/AppEntry-...js` نیز در این فهرست است.

## پوشش نصب مرورگرها

| مرورگر | قرارداد نصب خودکار | پذیرش UI روی دستگاه |
| --- | --- | --- |
| Chrome Android | PASS: manifest، ۱۹۲/۵۱۲، maskable، standalone، SW و HTTPS-ready | پس از deploy روی URL واقعی HTTPS، گزینه Add to Home Screen و اجرای آفلاین یک بار روی گوشی کنترل شود |
| Safari iPhone | PASS: Apple Touch Icon و همه متاتگ‌های standalone در HTML اولیه | پس از deploy، از Share > Add to Home Screen نصب و حالت بدون نوار Safari کنترل شود |
| Chrome/Edge Desktop | PASS: manifest کامل، آیکون ۵۱۲ و service worker | پس از deploy، آیکون Install در نوار آدرس و اجرای window مستقل کنترل شود |

محیط ساخت فعلی مرورگر موبایل فیزیکی و URL عمومی HTTPS ندارد؛ بنابراین منوی
واقعی نصب دستگاه جعل یا به‌عنوان تست‌شده گزارش نشده است. تمام پیش‌شرط‌های
قابل‌تست در build خودکار PASS هستند و چک‌لیست بالا پذیرش نهایی روی هاست واقعی
را دقیق می‌کند.

## آزمون پذیرش پس از انتشار

1. `npm run build:web` را اجرا و محتویات `dist/` را در ریشه دامنه HTTPS
   منتشر کنید.
2. سایت را یک بار آنلاین باز کنید و صبر کنید service worker فعال شود.
3. اپ را از مسیر مخصوص هر مرورگر نصب کنید.
4. مرورگر/اپ را کامل ببندید، اینترنت را قطع و آیکون نصب‌شده را اجرا کنید.
5. ورود به shell، onboarding و داده‌های IndexedDB را بررسی کنید.
6. در Cache Storage تأیید کنید `app-config.json` وجود ندارد؛ سپس آنلاین شوید،
   مقدار آن را تغییر دهید و refresh کنید تا آخرین نسخه خوانده شود.
