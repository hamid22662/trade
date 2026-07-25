# جایگزینی نسخه فعلی پروژه

1. اجرای Expo را با `Ctrl + C` متوقف کنید.
2. از پوشه فعلی پروژه و فایل `public/app-config.json` نسخه پشتیبان بگیرید.
3. ZIP جدید را در یک پوشه تازه Extract کنید.
4. در صورت نیاز، مقادیر عمومی قبلی را به `public/app-config.json` نسخه جدید
   منتقل کنید.
5. اعتبارسنجی و اجرا:

```bash
npm install
npm run check
npx expo start --clear
```

برای وب، محتویات `dist/` را روی هاست جایگزین کنید. بعد از deploy می‌توانید
`app-config.json` را مستقیم در File Manager هاست ویرایش کنید.
