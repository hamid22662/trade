# ساخت APK در GitHub Actions

workflow آماده در `.github/workflows/build-apk.yml` یک APK قابل نصب می‌سازد
و هیچ Secret یا متغیر محیطی برنامه دریافت نمی‌کند.

## راه‌اندازی

1. یک repository خصوصی در GitHub بسازید.
2. محتویات پروژه را طوری push کنید که `package.json`، `android` و `src` در
   ریشه repository باشند.
3. از تب **Actions**، workflow با نام **Build TradeLog APK** را باز کنید.
4. **Run workflow** را بزنید. push روی شاخه `main` نیز workflow را اجرا
   می‌کند.

## کارهایی که workflow انجام می‌دهد

1. نصب Node.js 20 و JDK 17
2. نصب وابستگی‌ها با `npm ci`
3. اجرای `npm run check` شامل تست‌های local-first و PWA
4. اجرای `npm run build:android-apk` و task بومی `assembleRelease`
5. بررسی ساختار APK با `android-apk-smoke.mjs`
6. تولید فایل SHA-256
7. آپلود artifact با نام `TradeLog-APK`

artifact شامل این دو فایل است:

```text
app-release.apk
app-release.apk.sha256
```

اگر APK ساخته نشود، ساختار کامل اپ نیتیو یا امضای آن وجود نداشته باشد،
workflow شکست می‌خورد و artifact ناقص منتشر نمی‌شود.

## دانلود و نصب

پس از سبز شدن workflow، اجرای مربوط را باز و artifact با نام
`TradeLog-APK` را دانلود کنید. ZIP را Extract و `app-release.apk` را روی
گوشی نصب کنید. برنامه در اولین اجرا به env، Secret یا اینترنت وابسته نیست و
داده‌های خود را در SQLite و فضای خصوصی اپ نگه می‌دارد.

این APK برای نصب و تست مستقیم است. برای انتشار Google Play باید امضای
production و خروجی AAB در یک workflow جداگانه تعریف شود.
