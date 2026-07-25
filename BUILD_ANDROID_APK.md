# ساخت APK قابل نصب TradeLog

این مسیر یک APK واقعی و امضاشده برای نصب مستقیم می‌سازد؛ خروجی Metro یا
پوشه‌ی bundle به‌عنوان APK تحویل داده نمی‌شود.

## پیش‌نیازهای ساخت محلی

- Node.js 20 یا جدیدتر
- JDK 17
- Android SDK با platform و build-tools موردنیاز پروژه
- متغیر استاندارد `ANDROID_HOME` یا تنظیم SDK در `android/local.properties`

هیچ فایل `.env`، متغیر محیطی برنامه، Secret یا سرویس backend برای ساخت لازم
نیست.

## ساخت و اعتبارسنجی

در ریشه پروژه اجرا کنید:

```bash
npm ci
npm run check
npm run build:android-apk
```

دستور آخر به‌شکل cross-platform فایل `gradlew` یا `gradlew.bat` را اجرا
می‌کند، task واقعی `assembleRelease` را می‌سازد و سپس ساختار APK را بررسی
می‌کند. تست فقط وقتی موفق می‌شود که APK شامل این اجزای واقعی باشد:

- `AndroidManifest.xml`
- `classes.dex`
- `assets/index.android.bundle`
- `resources.arsc`
- کتابخانه بومی React Native
- گواهی امضای APK

خروجی نهایی:

```text
android/app/build/outputs/apk/release/app-release.apk
```

نام قدیمی `npm run build:android-bundle` برای سازگاری باقی مانده، اما اکنون
همین مسیر APK واقعی را اجرا می‌کند.

## نصب روی گوشی

1. فایل `app-release.apk` را به گوشی منتقل کنید.
2. اجازه‌ی «Install unknown apps» را فقط برای Files یا مرورگر مورد استفاده
   فعال کنید.
3. APK را نصب و TradeLog را باز کنید.
4. برای آزمون آفلاین، قبل از اولین اجرا اینترنت گوشی را خاموش کنید؛
   onboarding و دیتابیس SQLite محلی باید بدون تنظیم اضافی باز شوند.

نسخه فعلی `1.0.2` با `versionCode=2` و شناسه
`com.tradelog.app` ساخته می‌شود.

## امضا و انتشار

پروفایل `release` فعلی عمداً با keystore توسعه‌ای موجود در پروژه امضا می‌شود
تا GitHub Actions بدون Secret یک APK قابل نصب برای تست مستقیم تولید کند. این
امضا برای انتشار عمومی در Google Play مناسب نیست. برای انتشار رسمی باید
keystore خصوصی انتشار را خارج از repository نگه داشت و یک مسیر امضای جداگانه
تعریف کرد؛ این موضوع برای ساخت APK تستی فعلی الزامی نیست.
