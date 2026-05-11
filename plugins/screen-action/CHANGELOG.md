# @gyo-framework/screen-action

## 0.1.0

- Initial release
- `tap({ x, y })` — tap at coordinates via dispatchGesture
- `type({ text })` — type text into focused node via ACTION_SET_TEXT
- `swipe({ startX, startY, endX, endY, duration })` — swipe gesture via dispatchGesture
- `globalAction({ action })` — perform global action (back, home, recents, notifications, quick_settings, power_dialog)
- Android `ScreenActionBridge` Kotlin handler (AccessibilityService)
