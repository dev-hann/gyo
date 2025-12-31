// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "{{PROJECT_NAME}}",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "{{PROJECT_NAME}}",
            targets: ["{{PROJECT_NAME}}"]
        )
    ],
    targets: [
        .target(
            name: "{{PROJECT_NAME}}",
            path: "Sources",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
