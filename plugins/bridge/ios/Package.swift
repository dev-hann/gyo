// swift-tools-version: 5.10

import PackageDescription

let package = Package(
    name: "ios",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "GyoBridge",
            targets: ["GyoBridge"]
        )
    ],
    targets: [
        .target(
            name: "GyoBridge",
            path: "Sources/GyoBridge"
        )
    ]
)
