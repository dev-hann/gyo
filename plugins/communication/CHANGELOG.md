# @gyo-community/communication

## 0.2.0 - 2026-11-27

- Replaces `@gyo-framework/contact-search`, `@gyo-framework/sms-sender` and `@gyo-framework/phone-caller`: the three packages are merged into this one
- `ContactSearch`, `SmsSender` and `PhoneCaller` keep their methods and types; only the import path changes, to `@gyo-community/communication`
- The three bridges become one, `communication`, answered by `gyo.plugins.communication.CommunicationBridge`. The method names and the JSON they take and return are unchanged: `search`, `send`, `read`, `call` and `get_call_log`
- `gyo run`, `gyo build android` and `gyo install` include the module in the app and register the handler. The module's manifest is empty, as the three were: no service and no `<queries>`
- Declares the run-time permissions of the three packages, so `gyo install` points them out while the app manifest lacks them: `READ_CONTACTS`, `SEND_SMS`, `READ_SMS`, `CALL_PHONE` and `READ_CALL_LOG`

## History

What the three packages released before they were merged.

### @gyo-framework/contact-search

#### 0.1.2 - 2026-11-27

- Version 0.1.1 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Declares the run-time permission it needs, so `gyo install` points it out while the app manifest lacks it

#### 0.1.0

- Initial release
- `search({ query })` — search contacts by display name
- Returns contact name, phone numbers, and emails
- Android `ContactSearchBridge` Kotlin handler (ContactsProvider)

### @gyo-framework/sms-sender

#### 0.1.3 - 2026-11-27

- Version 0.1.2 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Declares the run-time permissions it needs, so `gyo install` points them out while the app manifest lacks them

#### 0.1.0

- Initial release
- `send({ phoneNumber, message })` — send SMS via SmsManager
- `read({ limit })` — read recent SMS from inbox
- Android `SmsSenderBridge` Kotlin handler (SmsManager + ContentProvider)

### @gyo-framework/phone-caller

#### 0.1.3 - 2026-11-27

- Version 0.1.2 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Declares the run-time permissions it needs, so `gyo install` points them out while the app manifest lacks them

#### 0.1.0

- Initial release
- `call({ phoneNumber })` — make phone call via ACTION_CALL intent
- `getCallLog({ limit })` — query CallLog.Calls content provider
- Android `PhoneCallerBridge` Kotlin handler (Telephony/CallLog)
