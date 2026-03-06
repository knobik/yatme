# Drag & Drop — Features To Add

## Cross-Floor Drag
Drag items between different Z levels. Currently drag-move is locked to the current floor.

## Drag from Inspector / Browse Tile
Allow dragging individual items out of the inspector panel onto the map, and reordering items within the panel via drag.

## Item-Level Drag (Single Item from Stack)
Currently only the top item or the entire selection can be dragged. To select a mid-stack item you must use Browse Tile first (same as RME — it also only picks the top item on map click). This is low priority since it matches RME behavior.

## Drag Visual Cursor Feedback
Show a custom cursor during drag operations (e.g., "move" cursor with item preview attached to pointer). Currently the ghost preview renders on the map canvas but the system cursor doesn't change.

## CopyBuffer Class
RME has a dedicated `CopyBuffer` (`copybuffer.h/.cpp`) that acts as a reusable buffer with serialization support. Our clipboard is simpler React state — functional but less robust. Consider a dedicated buffer class if we need serialization or persistence.
