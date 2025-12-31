# CLI Commands

This directory contains the implementation for each CLI command. Use the `commander` library to define and implement the logic for each command.

## Command Implementation Guide

Each file should export a function that takes a `commander.Command` object as an argument and registers the specific command.

### `create.ts`

**Command:** `gyo create <project-name>`

**Purpose:** Scaffolds a new `gyo` project.

**Implementation Steps:**
1.  Define the `create` command with one required argument: `<project-name>`.
2.  Check if a directory with `<project-name>` already exists. If it does, exit with an error.
3.  Create the project directory.
4.  Copy the base project structure from the `templates/` directory into the new project directory. This should include templates for `web`, `android`, `ios`, etc.
5.  Perform any necessary initial configuration, such as renaming files or setting the project name in configuration files.
6.  Log a success message to the user, indicating that the project has been created and what the next steps are.

### `build.ts`

**Command:** `gyo build <platform>`

**Purpose:** Builds the native application for the specified platform.

**Implementation Steps:**
1.  Define the `build` command with one required argument: `<platform>` (e.g., 'android', 'ios').
2.  Validate that the `<platform>` argument is a supported platform.
3.  Locate the project's native directory for the given platform (e.g., `my-project/android`).
4.  Execute the platform-specific build command:
    -   For `android`: Run the appropriate Gradle command (e.g., `./gradlew assembleRelease`).
    -   For `ios`: Run the appropriate Xcode command-line tool (`xcodebuild`).
5.  Stream the output of the build process to the user's console.
6.  Log a success or failure message based on the build command's exit code.

### `run.ts`

**Command:** `gyo run <platform>`

**Purpose:** Runs the application on a connected device or emulator/simulator.

**Implementation Steps:**
1.  Define the `run` command with one required argument: `<platform>`.
2.  Validate the `<platform>`.
3.  Execute the platform-specific run command:
    -   For `android`: Use `adb` and `am` commands or a Gradle task (e.g., `./gradlew installDebug`).
    -   For `ios`: Use `xcrun simctl` to install and launch the app on a simulator, or tools for physical devices.
4.  The command should stream device logs to the console.
5.  (Optional) This command could also start a local dev server for the web content if a `--dev` flag is present.

### `doctor.ts`

**Command:** `gyo doctor`

**Purpose:** Checks the user's environment for all required dependencies and configurations.

**Implementation Steps:**
1.  Define the `doctor` command.
2.  Create a list of checks to perform. Examples:
    -   Is Node.js installed? Check version.
    -   Is `npm` installed?
    -   For Android: Is the Android SDK installed? Are environment variables (`ANDROID_HOME`) set? Is `adb` available?
    -   For iOS (on macOS): Is Xcode installed? Are the Xcode command-line tools installed? Is `xcrun` available?
3.  Execute each check and collect the results.
4.  Display a summary report to the user, showing which checks passed and which failed.
5.  For failed checks, provide helpful messages on how to resolve the issue (e.g., "Android SDK not found. Please install Android Studio and configure the ANDROID_HOME environment variable.").

### `dev.ts`

**Command:** `gyo dev`

**Purpose:** Start development server and watch for changes. This command runs the web development server and optionally launches the native app.

**Implementation Steps:**
1.  Define the `dev` command with an optional `--platform` option.
2.  Load the project configuration from `gyo.config.json`.
3.  Start the web development server (typically using Vite or Webpack dev server).
4.  If a platform is specified, attempt to launch the native app on that platform.
5.  Watch for changes and support hot reload for the web content.
6.  Handle graceful shutdown when the user presses Ctrl+C.

### `config.ts`

**Command:** `gyo config`

**Purpose:** Manage gyo configuration through CLI commands.

**Subcommands:**
-   `gyo config show`: Display the current configuration
-   `gyo config get <key>`: Get a specific configuration value
-   `gyo config set <key> <value>`: Set a specific configuration value

**Implementation Steps:**
1.  Define the main `config` command with subcommands.
2.  For `show`: Read and display the entire `gyo.config.json` file.
3.  For `get <key>`: Parse the key path (e.g., `platforms.android.enabled`) and retrieve the value.
4.  For `set <key> <value>`: Parse the key path, update the value in the configuration object, and save it back to `gyo.config.json`.
5.  Handle type conversion for values (boolean, number, string).
6.  Validate that the key exists before attempting to get or set.
