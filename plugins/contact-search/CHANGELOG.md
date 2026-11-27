# @gyo-framework/contact-search

## 0.1.2 - 2026-11-27

- Version 0.1.1 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Declares the run-time permission it needs, so `gyo install` points it out while the app manifest lacks it

## 0.1.0

- Initial release
- `search({ query })` — search contacts by display name
- Returns contact name, phone numbers, and emails
- Android `ContactSearchBridge` Kotlin handler (ContactsProvider)
