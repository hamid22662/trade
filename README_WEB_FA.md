# راه‌اندازی نسخه وب/PWA محلی TradeLog

نسخه وب تمام داده‌های ژورنال را در IndexedDB مرورگر نگه می‌دارد. تنظیمات
عمومی اپ نیز از فایل استاتیک `/app-config.json` روی همان هاست خوانده می‌شوند؛
هیچ سرویس دیتابیس، ورود کاربر یا backend ابری لازم نیست.

## نصب و ساخت

```bash
npm install
npm run check
npm run build:web
```

خروجی قابل انتشار داخل `dist/` قرار می‌گیرد. تست build تأیید می‌کند که
`public/app-config.json` بدون تغییر در `dist/app-config.json` کپی شده، آیکون‌ها
ابعاد واقعی دارند و shell برنامه در service worker ثبت شده است.

## تنظیم app-config.json

نمونه پیش‌فرض:

```json
{
  "telegram_support_username": "",
  "sponsor_banner": {
    "image_url": "",
    "target_url": "",
    "enabled": false
  },
  "ad_network_ids": {
    "adsense_web": "",
    "admob_android": ""
  },
  "min_app_version": "1.0.2",
  "force_update_message": "برای ادامه استفاده از TradeLog، لطفاً برنامه را به آخرین نسخه به‌روزرسانی کنید."
}
```

این فایل عمومی است و نباید رمز، API secret یا اطلاعات خصوصی داخل آن قرار
بگیرد. برای تغییر تنظیمات بعد از انتشار، فایل `app-config.json` را مستقیماً
در ریشه هاست ویرایش کنید؛ build دوباره لازم نیست. اگر هاست یا CDN فایل JSON
را cache می‌کند، cache را نیز پاک کنید.

## انتشار روی DirectAdmin

محتویات `dist` را داخل `public_html` آپلود کنید. ساختار اصلی باید شبیه این
باشد:

```text
public_html/
├── index.html
├── app-config.json
├── manifest.webmanifest
├── sw.js
├── favicon.png
├── icons/
├── metadata.json
├── _expo/
└── assets/
```

برای SPA می‌توانید از این تنظیم Apache استفاده کنید:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On

    RewriteCond %{HTTPS} !=on
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>
```

شرط `!-f` باعث می‌شود `/app-config.json` به‌عنوان فایل واقعی سرو شود و به
`index.html` بازنویسی نشود.

## آزمایش انتشار

- سایت و مسیر `/app-config.json` باید با HTTPS و status 200 باز شوند.
- در Chrome/Edge گزینه Install و در Safari iPhone گزینه Add to Home Screen را
  بررسی کنید.
- سایت را یک بار آنلاین باز کنید، سپس اینترنت را قطع و آیکون نصب‌شده را
  دوباره اجرا کنید؛ shell و داده‌های IndexedDB باید باز شوند.
- در DevTools > Application تأیید کنید `app-config.json` داخل Cache Storage
  نیست.
- یک مقدار عمومی را در فایل روی هاست تغییر دهید و صفحه را دوباره بارگذاری
  کنید.
- ساخت/ویرایش/بستن ترید، تصاویر، داشبورد، تحلیل و refresh مرورگر را بررسی
  کنید.
- Export و Restore بکاپ JSON را با یک فایل واقعی آزمایش کنید.
