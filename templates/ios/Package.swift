// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "{{PROJECT_NAME}}",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "{{PROJECT_NAME}}",
            targets: ["{{PROJECT_NAME}}"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/gyo-ai/gyo-plugins-ios.git", from: "0.1.0")
    ],
    targets: [
        .target(
            name: "{{PROJECT_NAME}}",
            dependencies: [
                .product(name: "GyoBridge", package: "gyo-plugins-ios")
            ],
            path: "Sources",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
