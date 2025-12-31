# CLI Source (`src`)

This directory contains the main source code for the `gyo` CLI.

## File Structure

-   `index.ts`: The main entry point for the CLI application. Its primary role is to configure `commander.js`, register all available commands, and parse the command-line arguments.
-   `commands/`: This directory holds the implementation for each individual CLI command. See `cli/src/commands/README.md` for detailed implementation guidance.
-   `utils/`: This directory is for shared utility functions that can be reused across multiple commands (e.g., file system operations, logging functions, configuration loaders).
