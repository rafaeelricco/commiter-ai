#!/bin/bash

echo "Starting VS Code Extension Development Environment"
echo "=================================================="

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "VS Code CLI 'code' not found. Please install VS Code command line tools."
    echo "   Run: code --install-extension ms-vscode.vscode-typescript-next"
    exit 1
fi

# Start TypeScript compiler in watch mode
echo "Starting TypeScript compiler in watch mode..."
npm run watch &
WATCH_PID=$!

# Wait a moment for compilation to start
sleep 2

# Open VS Code in current directory
echo "Opening VS Code..."
code .

echo ""
echo "Development environment ready!"
echo ""
echo "Next steps:"
echo "   1. In VS Code, press F5 or go to Run & Debug → 'Run Extension'"
echo "   2. This will open Extension Development Host window"
echo "   3. Make changes to your code"
echo "   4. Reload Extension Host with Ctrl+R (Cmd+R on Mac)"
echo ""
echo "TypeScript watch mode is running in background (PID: $WATCH_PID)"
echo "To stop: Press Ctrl+C or run 'kill $WATCH_PID'"
echo ""

# Keep the script running and handle cleanup
cleanup() {
    echo ""
    echo "Stopping development environment..."
    kill $WATCH_PID 2>/dev/null
    echo "Stopped TypeScript watch mode"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for user to stop
echo "Press Ctrl+C to stop development environment..."
wait $WATCH_PID