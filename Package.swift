// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "gyo",
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
            path: "plugins/ios/Sources/GyoBridge"
        )
    ]
)
