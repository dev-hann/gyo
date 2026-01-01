#!/bin/bash

echo "🚀 Starting Gyo CLI development mode..."
echo ""
echo "This will:"
echo "  1. Build the CLI"
echo "  2. Watch for changes and rebuild automatically"
echo ""
echo "In another terminal, you can run 'gyo' commands to test your changes."
echo ""

cd "$(dirname "$0")"

# Initial build
npm run build

echo ""
echo "✓ Initial build complete!"
echo "👀 Watching for changes... (Press Ctrl+C to stop)"
echo ""

# Watch mode
npm run watch
