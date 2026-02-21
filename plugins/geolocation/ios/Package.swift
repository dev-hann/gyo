// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GyoGeolocation",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "GyoGeolocation",
            targets: ["GyoGeolocation"]
        )
    ],
    targets: [
        .target(
            name: "GyoGeolocation",
            path: "Sources"
        )
    ]
)
