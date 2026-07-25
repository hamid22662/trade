# مرحله ۱۳ — پایپ‌لاین کامل APK

تاریخ بررسی: ۲۵ ژوئیه ۲۰۲۶

## اصلاح مسیر build

- `npm run build:android-apk` اکنون wrapper بومی Gradle را به‌صورت
  cross-platform اجرا می‌کند:

  ```text
  gradlew assembleRelease --no-daemon
  ```

- نام سازگار `npm run build:android-bundle` نیز به همین دستور واقعی وصل شده و
  دیگر `expo export` یا bundle تنها تولید نمی‌کند.
- خروجی مورد انتظار
  `android/app/build/outputs/apk/release/app-release.apk` است.
- پس از Gradle، `android-apk-smoke.mjs` آرشیو APK را مستقیم بازبینی می‌کند و
  وجود Android manifest، DEX، JavaScript bundle جاسازی‌شده، resources و
  کتابخانه بومی React Native را الزامی می‌داند.
- امضای APK با `apksigner verify --verbose` بررسی می‌شود؛ artifact بدون امضا
  PASS نمی‌شود.
- نسخه Android با app config همسان شد: `1.0.2` و `versionCode=2`.
- آیکون‌های placeholder موجود در منابع Android با هویت واقعی TradeLog
  جایگزین شدند.

## GitHub Actions

workflow `.github/workflows/build-apk.yml` این ترتیب fail-closed را اجرا
می‌کند:

1. `npm ci`
2. `npm run check`
3. `npm run build:android-apk`
4. محاسبه SHA-256
5. انتشار APK و checksum فقط در صورت وجود خروجی

هیچ `secrets.*`، `env:` برنامه، متغیر `EXPO_PUBLIC_*` یا وابستگی تنظیمات
backend در workflow وجود ندارد. راهنماهای `BUILD_ANDROID_APK.md` و
`GITHUB_APK_BUILD.md` نیز مطابق همین مسیر واقعی بازنویسی شدند.

## نتیجه تست‌های مستقل

| تست | نتیجه | توضیح |
| --- | --- | --- |
| `npm run test:android-pipeline` | PASS | اتصال Gradle، artifact، نسخه، launcher، امضا و نبود Secret/env |
| Android Metro/Hermes export با `EXPO_NO_DOTENV=1` و همه fallbackهای عمومی unset | PASS | یک bundle واقعی HBC با اندازه حدود ۶.۱ MB ساخته شد |
| جست‌وجوی Supabase در bundle Android بدون env | PASS | هیچ کلید یا کلاینت Supabase در خروجی نبود |
| کنترل مرز local-first | PASS | شروع مستقیم AppProvider، SQLite محلی، فایل‌های خصوصی و نبود auth/backend |
| اجرای محلی `npm run build:android-apk` | BLOCKED BY RUNNER | wrapper قبل از compile برای دانلود Gradle به شبکه نیاز داشت؛ شبکه runner فعلی بسته است |

خطای اجرای آخر `Network is unreachable` هنگام دریافت
`gradle-9.3.1-bin.zip` بود و قبل از configure/compile پروژه رخ داد. این محدودیت
زیرساختی است، نه خطای Gradle پروژه؛ Android SDK نیز در runner فعلی نصب نیست.
به همین دلیل تولید APK واقعی یا ادعای نصب دستگاه در این محیط ممکن نبود.

اجرای GitHub-hosted workflow، تست نهایی end-to-end است چون runner آن JDK،
Android SDK و دسترسی دانلود Gradle را دارد. خود workflow طوری بسته شده که اگر
APK واقعی، ساختار نیتیو یا امضا موجود نباشد، مرحله build شکست می‌خورد و
artifact منتشر نمی‌شود.

## پذیرش نهایی APK

1. workflow را در GitHub اجرا کنید.
2. artifact با نام `TradeLog-APK` را دانلود و checksum را بررسی کنید.
3. اینترنت گوشی را قبل از اولین اجرا خاموش کنید.
4. APK را نصب و onboarding را باز کنید.
5. یک ترید ثبت کنید، اپ را force-stop و دوباره باز کنید تا ماندگاری SQLite
   تأیید شود.
6. باز شدن بدون فایل `.env`، حساب کاربری، Secret یا اتصال اینترنت را ثبت
   کنید.

APK فعلی برای نصب و تست مستقیم با keystore توسعه‌ای امضا می‌شود. امضای
production و AAB فروشگاه یک مسیر جداگانه است و برای این artifact تستی لازم
نیست.
