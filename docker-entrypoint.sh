#!/bin/sh
set -e

SPRITES_INPUT_DIR="${ASSETS_DIR:-/app/sprites}"
SPRITES_OUTPUT_DIR="${SPRITES_INPUT_DIR}-png"

export SPRITES_INPUT_DIR SPRITES_OUTPUT_DIR

# Convert sprites if not already done
if [ -d "$SPRITES_INPUT_DIR" ] && [ ! -f "$SPRITES_OUTPUT_DIR/catalog-content.json" ]; then
  echo "Converting sprites from $SPRITES_INPUT_DIR to $SPRITES_OUTPUT_DIR..."
  npx tsx scripts/convert-sprites.ts
  echo "Sprite conversion complete."
fi

# Point assets at the converted sprites-png directory if it exists
if [ -d "$SPRITES_OUTPUT_DIR" ]; then
  export ASSETS_DIR="$SPRITES_OUTPUT_DIR"
fi

exec "$@"
