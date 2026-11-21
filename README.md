# Учёт MasterMitsu — Android (автономный APK)

Полностью офлайн-приложение: заказы хранятся в **IndexedDB** на устройстве, интернет не нужен.

## Возможности

- Создание / редактирование / удаление заказов  
- Поиск, статусы, доставка  
- Аналитика за неделю и месяц  
- Выгрузка CSV  

## Быстрый старт (собрать APK)

### Вариант A — Android Studio (рекомендуется)

1. Установите [Android Studio](https://developer.android.com/studio) (с Android SDK 34+).
2. На компьютере:

```bash
cd android-app
npm install
npx cap add android    # один раз
npx cap sync android
npx cap open android   # откроет Android Studio
```

3. В Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.  
   Готовый файл: `android/app/build/outputs/apk/debug/app-debug.apk`.

Для релизного APK: **Build → Generate Signed Bundle / APK** (нужен keystore).

### Вариант B — командная строка (после установки SDK)

```bash
cd android-app
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

### Проверка веб-части без Android

```bash
cd android-app/www
# любой статический сервер, например:
npx --yes serve -p 5173
# открыть http://localhost:5173
```

## Структура

```
android-app/
  www/           — офлайн UI (HTML/CSS/JS + IndexedDB)
  capacitor.config.json
  package.json
  android/       — появится после `npx cap add android`
```

## Важно

- Данные **не синхронизируются** с веб-версией на Искре — это отдельное автономное хранилище.
- При удалении приложения данные стираются вместе с ним.
- Для резервной копии используйте кнопку **CSV** в аналитике.
