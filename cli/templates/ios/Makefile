# Makefile for iOS project using XcodeGen

.PHONY: generate build clean install-xcodegen

# Generate Xcode project from project.yml
generate:
	@echo "Generating Xcode project..."
	@if command -v xcodegen >/dev/null 2>&1; then \
		xcodegen generate; \
	else \
		echo "Error: XcodeGen is not installed."; \
		echo "Install it with: brew install xcodegen"; \
		echo "Or visit: https://github.com/yonaskolb/XcodeGen"; \
		exit 1; \
	fi

# Build the project
build: generate
	@echo "Building iOS app..."
	xcodebuild -project {{PROJECT_NAME}}.xcodeproj \
		-scheme {{PROJECT_NAME}} \
		-configuration Debug \
		-sdk iphonesimulator \
		-destination 'platform=iOS Simulator,name=iPhone 14' \
		build

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf build/
	rm -rf DerivedData/
	rm -f {{PROJECT_NAME}}.xcodeproj

# Install XcodeGen (macOS only)
install-xcodegen:
	@echo "Installing XcodeGen..."
	@if [[ "$$(uname)" == "Darwin" ]]; then \
		brew install xcodegen; \
	else \
		echo "XcodeGen installation on Linux requires manual setup."; \
		echo "Visit: https://github.com/yonaskolb/XcodeGen"; \
	fi

# Run on simulator
run: build
	@echo "Running on simulator..."
	xcrun simctl boot "iPhone 14" || true
	xcrun simctl install booted build/Debug-iphonesimulator/{{PROJECT_NAME}}.app
	xcrun simctl launch booted {{PACKAGE_NAME}}
