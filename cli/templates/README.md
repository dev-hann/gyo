# Project Templates

Templates for `gyo create` project scaffolding.

## Structure

```
templates/
├── android/        # Gradle-based Android project
├── ios/            # xtool-based iOS project
├── lib/            # React + Vite web app (scaffolded at create time)
└── gyo.config.json # Configuration template
```

## Template Variables

| Placeholder | Replaced with |
|-------------|---------------|
| `{{PROJECT_NAME}}` | Project name (e.g. "MyApp") |
| `{{PROJECT_NAME_LOWER}}` | Lowercase project name (e.g. "myapp") |
| `{{PACKAGE_NAME}}` | Package name (e.g. "com.example.myapp") |

## Platform Details

| Platform | Build System | Language | Details |
|----------|-------------|----------|---------|
| Android | Gradle | Kotlin | [android/README.md](./android/README.md) |
| iOS | xtool | Swift | [ios/README.md](./ios/README.md) |
| Web | Vite | TypeScript | Scaffolded via `create-vite` or `create-next-app` |
