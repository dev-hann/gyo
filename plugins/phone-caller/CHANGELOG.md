# @gyo-framework/phone-caller

## 0.1.3 - 2026-11-27

- Version 0.1.2 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Declares the run-time permissions it needs, so `gyo install` points them out while the app manifest lacks them

## 0.1.0

- Initial release
- `call({ phoneNumber })` — make phone call via ACTION_CALL intent
- `getCallLog({ limit })` — query CallLog.Calls content provider
- Android `PhoneCallerBridge` Kotlin handler (Telephony/CallLog)
