#!/usr/bin/env bash
# Install Fabro CLI for macOS (Apple Silicon).
# Note: The open source Fabro binary does NOT include "fabro serve" (API server).
# Server mode is in private early access per https://docs.fabro.sh/administration/deploy-server
#
# For local development, use demo mode instead:
#   NEXT_PUBLIC_FABRO_DEMO=1 npm run dev
set -e
FABRO_VERSION="${FABRO_VERSION:-v0.176.2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/.fabro-bin"
mkdir -p "$INSTALL_DIR"

case "$(uname -m)" in
  arm64|aarch64) ARCH="aarch64-apple-darwin" ;;
  x86_64)
    echo "Intel Mac: Fabro only publishes aarch64 for darwin."
    exit 1
    ;;
  *)             echo "Unsupported arch: $(uname -m)"; exit 1 ;;
esac

FABRO_BIN="$INSTALL_DIR/fabro"
if [[ ! -x "$FABRO_BIN" ]]; then
  echo "Downloading Fabro $FABRO_VERSION for $ARCH..."
  URL="https://github.com/fabro-sh/fabro/releases/download/${FABRO_VERSION}/fabro-${ARCH}.tar.gz"
  curl -fsSL "$URL" | tar -xz -C "$INSTALL_DIR" --strip-components=1
  chmod +x "$FABRO_BIN"
  echo "Fabro CLI installed to $FABRO_BIN"
fi

echo ""
echo "Fabro server mode (fabro serve) is not in the open source release."
echo "It's in private early access: https://docs.fabro.sh/administration/deploy-server"
echo ""
echo "For local development, use demo mode:"
echo "  NEXT_PUBLIC_FABRO_DEMO=1 npm run dev"
echo ""
echo "Or run workflows via CLI: $FABRO_BIN run workflow.fabro"
