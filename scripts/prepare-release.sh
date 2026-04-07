#!/usr/bin/env bash
set -euo pipefail

# Release preparation script for DEV-gem
# This creates a production-ready release and installs it globally

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "======================================"
echo "  DEV-gem Release Preparation"
echo "======================================"
echo ""

# Detect system info
OS_NAME=$(uname -s)
OS_ARCH=$(uname -m)
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "📋 System Detection:"
echo "  OS: $OS_NAME $OS_ARCH"
echo "  Node: $NODE_VERSION"
echo "  npm: $NPM_VERSION"
echo ""

# Check Node version
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Error: Node.js 20+ required (found: $NODE_VERSION)"
  exit 1
fi

echo "✅ Node.js version check passed"
echo ""

# Step 1: Build the project
echo "🔨 Building project..."
npm run bundle 2>&1 | tail -5
echo "✅ Build complete"
echo ""

# Step 2: Verify bundle
echo "🔍 Verifying release..."
if [ ! -f "bundle/gemini.js" ]; then
  echo "❌ Error: bundle/gemini.js not found!"
  exit 1
fi

BUNDLE_SIZE=$(stat -f%z "bundle/gemini.js" 2>/dev/null || stat -c%s "bundle/gemini.js" 2>/dev/null)
BUNDLE_SIZE_KB=$(echo "scale=2; $BUNDLE_SIZE / 1024" | bc 2>/dev/null || echo "unknown")

echo "  ✅ bundle/gemini.js: ${BUNDLE_SIZE_KB} KB"
VERSION=$(node -p "require('./package.json').version")
echo "  ✅ Version: $VERSION"
echo ""

# Step 3: Install globally using npm link (required for workspaces)
echo "🚀 Installing globally..."
npm link 2>&1 | tail -15
echo ""

# Step 4: Verify installation
echo "🔍 Verifying installation..."
sleep 2  # Wait for npm to update PATH

export PATH="$(npm config get prefix)/bin:$PATH"

if command -v gemini &> /dev/null; then
  echo "✅ 'gemini' command available at: $(which gemini)"
  GEMINI_VERSION=$(gemini --version 2>&1 || echo "version check failed")
  echo "  Version: $GEMINI_VERSION"
else
  NPM_BIN=$(npm config get prefix)/bin
  echo "⚠️  'gemini' not in PATH"
  echo "  npm bin dir: $NPM_BIN"
  if [ -f "$NPM_BIN/gemini" ]; then
    echo "  ✅ Binary exists at: $NPM_BIN/gemini"
    echo "  Add to PATH: export PATH=\"$NPM_BIN:\$PATH\""
  fi
fi
echo ""

# Step 5: Create user directories
echo "📂 Setting up user directories..."
mkdir -p ~/.gemini
mkdir -p ~/.gemini/tmp
mkdir -p ~/.gemini/skills
mkdir -p ~/.gemini/agents
mkdir -p ~/.gemini/policies

chmod 700 ~/.gemini
chmod 700 ~/.gemini/tmp

echo "✅ User directories created"
echo ""

# Step 6: Print summary
echo "======================================"
echo "  ✅ Release Installation Complete!"
echo "======================================"
echo ""
echo "Version: $VERSION"
echo "Node: $NODE_VERSION"
echo "System: $OS_NAME $OS_ARCH"
echo ""
echo "📝 Next Steps:"
echo "  1. Test: gemini --help"
echo "  2. Auth: gmi auth login"
echo "  3. Start: cd your-project && gmi"
echo ""
echo "🔧 Optional: Add to ~/.zshrc"
echo ""
echo "--- Add these lines to ~/.zshrc ---"
echo "export PATH=\"$(npm config get prefix)/bin:\$PATH\""
echo "alias gmi='gemini'"
echo "alias geminiM='gemini'"
echo "alias gmi2='GEMINI_CLI_HOME=~/.gemini2 gemini'"
echo "alias gmi3='GEMINI_CLI_HOME=~/.gemini3 gemini'"
echo "alias gorchestra='gemini'"
echo "alias glog='cat .gemini-context/SESSION_LOG.md'"
echo "-------------------------------------"
echo ""
echo "After adding, run: source ~/.zshrc"
echo ""
