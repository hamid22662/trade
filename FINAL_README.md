# راهنمای نهایی TradeLog

TradeLog یک پروژه local-first است:

- وب/PWA: داده‌های ژورنال در IndexedDB مرورگر
- اندروید: داده‌ها در SQLite و تصاویر در فضای خصوصی اپ
- تنظیمات عمومی: فایل استاتیک `/app-config.json` روی همان هاست PWA

هیچ حساب کاربری، دیتابیس ابری یا کلید backend برای اجرای برنامه لازم نیست.

## اجرا و اعتبارسنجی

```bash
npm install
npm run check
npm run build:android-apk
```

## انتشار وب

```bash
npm run build:web
```

محتویات `dist/` را در ریشه هاست آپلود کنید. فایل
`dist/app-config.json` باید کنار `index.html` قرار بگیرد. بعد از deploy
می‌توانید آن را مستقیم از File Manager ویرایش کنید؛ نیازی به build مجدد
نیست.

فایل‌های manifest، آیکون‌ها و service worker نیز در `dist/` تولید می‌شوند.
پس از اولین بارگذاری موفق روی HTTPS، shell برنامه بدون اینترنت باز می‌شود؛
`app-config.json` عمداً cache نمی‌شود.

راهنمای کامل انتشار و ساختار فایل تنظیمات در `README_WEB_FA.md` و جزئیات
بکاپ در `docs/STAGE_6_7_BACKUP_AND_STAGE_8_APP_CONFIG_FA.md` آمده است.
