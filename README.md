# Gyo Framework

[![NPM version](https://img.shields.io/npm/v/gyo.svg?style=flat)](https://www.npmjs.com/package/gyo)
[![Build Status](https://img.shields.io/travis/com/gyo-framework/gyo/main.svg?style=flat)](https://travis-ci.com/gyo-framework/gyo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A framework for easily building beautiful cross-platform native applications with web technologies.

Gyo is a framework that allows you to develop Android and iOS applications using modern web technologies such as React, Vite, and TypeScript. It enables simultaneous development of apps for both platforms with a single shared web codebase, and easily integrates with native functionalities when needed.

## ✨ Key Features

- **🚀 Simple CLI:** Manage all processes, including project creation, execution, and building, with simple commands via the `gyo` CLI.
- **🌐 Web Technology Centric:** Develop apps by leveraging familiar React and the vast ecosystem of web libraries.
- **💻 Multi-platform Support with a Single Codebase:** Maximize development productivity by sharing web code written in the `lib` folder between Android and iOS.
- **🔌 Native Integration:** Seamless communication between web and native code is possible via the `runtime` bridge, allowing easy use of device-specific features like camera, GPS, etc. (Planned for future implementation)
- **📦 Template-Based:** Quickly start new projects based on proven project templates.

## 🚀 Getting Started

> **⚠️ Warning:** `gyo` is currently in its early development stages. The process below represents the target workflow.

1.  **Install CLI Globally**
    ```bash
    # Run from the gyo/cli folder
    npm install -g .
    ```

2.  **Create a Project**
    ```bash
    gyo create my-awesome-app
    cd my-awesome-app
    ```

3.  **Run the App**
    ```bash
    # Run Android app (requires Android Studio emulator or connected device)
    gyo run android

    # Run iOS app (requires macOS and Xcode)
    gyo run ios
    ```

## 📂 Folder Structure

```
gyo/
├── cli/          # CLI tool for project management
├── docs/         # Official documentation
├── examples/     # Example projects for various features
├── runtime/      # Runtime bridge for web-native communication
├── templates/    # Templates used for project creation
└── README.md     # Project introduction
```

## 🎯 Top 5 Priority Todo List

These are the top priorities for stabilizing the project and implementing core functionalities.

1.  **[Runtime] Implement basic web-native communication channel:** Prioritize the development of the core bridge for sending and receiving messages between webview and native code.
2.  **[CLI] Complete `run` and `build` command functionalities:** Implement the logic for `gyo run` and `gyo build` commands to actually compile and execute/build apps based on `templates`.
3.  **[Docs] Document 'Getting Started' tutorial:** Create official documentation that comprehensively guides developers through installing `gyo` and running their first app.
4.  **[Runtime] Implement at least one native API module:** To validate the utility of `runtime`, implement an API that calls at least one native function (e.g., camera, GPS, file system) and create an example.
5.  **[CLI] Enhance `doctor` command functionality:** Improve the `gyo doctor` command to accurately diagnose development environments (Node, JDK, Android SDK, Xcode, etc.) and suggest solutions.

## 🤝 Contributing

Gyo is an open-source project. Your contributions are always welcome! Whether it's bug reports, feature suggestions, or code contributions, any form of participation is appreciated. Please refer to the `CONTRIBUTING.md` file for more details. (The CONTRIBUTING.md file will be added later.)

## 📝 License

Gyo is licensed under the [MIT License](https://opensource.org/licenses/MIT).