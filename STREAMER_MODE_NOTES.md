# Streamer HUD Mode Implementation Notes

## Overview
Implemented a special "Streamer HUD Mode" for Face Controls that renders only the avatar HUD elements without background game elements. This mode is designed for VTubers and streamers to use as an overlay in OBS.

## Features Implemented

### 1. Command-line Flag
- `--stream-mode`: Activates streamer HUD mode
- `--bg-color`: Optional background color (black, green, blue, white, transparent)

### 2. Stream Mode Changes
- Window is borderless (no title bar or chrome)
- Resolution set to 1280x720 (720p) for streaming compatibility
- Background rendering disabled (no enemies, bosses, or environment)
- Only avatar faces, HUD elements, and attack indicators are rendered
- Watermark displayed: "🎥 Streamer HUD Mode - Press ESC to Exit"

### 3. Controls
- ESC key exits the application in stream mode
- All other controls work as normal

## Usage Examples

```bash
# Basic stream mode with transparent background
python main.py --stream-mode

# Stream mode with black background
python main.py --stream-mode --bg-color black

# Stream mode with green background (for chroma keying)
python main.py --stream-mode --bg-color green
```

## OBS Setup
1. Add a "Window Capture" source in OBS
2. Select the Face Controls window
3. Position and scale as needed
4. The borderless window makes it easy to capture without cropping

## Platform-Specific Notes
- **macOS**: Window layering works well, borderless mode fully supported
- **Windows**: May need to run as administrator for always-on-top (not implemented)
- **Linux**: Borderless mode support varies by window manager

## What's Rendered in Stream Mode
- Avatar faces with all expressions
- Eye tracking and blinking
- Mouth movements and speech indicators
- Arm movements based on hand detection
- Player health (hearts)
- Attack visuals (lasers/fireballs from hands and eyes)
- Kill counter and game state text
- Stream mode watermark

## What's NOT Rendered in Stream Mode
- Enemy creatures
- Boss characters
- Background environment
- Victory messages
- Boss health bars

## Future Enhancements
- Configurable HUD element positions
- Alpha channel support for true transparency
- Always-on-top window option
- Custom resolution settings
- Avatar position presets (corners, edges)