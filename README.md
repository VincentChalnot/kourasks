# KOURASKS - Game Implementation

## Overview

KOURASKS is a satirical idle/clicker game about tech over-engineering, implemented as a static SPA with no build
process.

## Technical Stack

- **Alpine.js** (15KB) - Reactive DOM framework
- **js-yaml** - YAML configuration loader
- **Pico.css** (10KB) - Base styling
- **Vanilla JavaScript** - Game logic
- **LocalStorage** - Game state persistence

## Files

- `index.html` - Main HTML structure, UI, and modals (381 lines)
- `app.css` - Custom styling and layout (660 lines)
- `app.js` - Complete game engine and logic (958 lines)
- `data/*.yaml` - Game configuration (hardware, services, projects, mails)

## How to Run

1. Open `index.html` in a modern web browser
2. The game will automatically:
    - Load YAML configuration from `/data/` folder
    - Initialize or load saved game from localStorage
    - Start the game loop
    - Display initial UI

## Game Mechanics Implemented

### Core Loop

- **Tick system**: 100ms intervals
- **Trimester tracking**: 6 minutes real-time = 1 trimester
- **Auto-save**: Every 10 seconds to localStorage

### Hardware System

- Deploy hardware instances
- Track running status (running, crashed, deploying, restarting, stopped)
- Monitor load/capacity with throttling
- Crash simulation based on crashRate
- Sell hardware with value recovery

### Service System

- Deploy service instances with specific versions
- Assign to hardware (if requireHardware: true)
- Assign to projects (if global: false)
- Version management with deprecation tracking
- Crash simulation and restart mechanics
- Status tracking (running, crashed, deploying, restarting, stopped)

### Project System

- Multiple active projects
- Version management with automatic version detection
- KPI tracking with trimester targets
- Strike system (3 strikes = project cancelled)
- Production tracking and history
- Service type requirements validation

### Yield Calculation

Implements the complete yield calculation system from specs:

1. Calculate base service yields
2. Apply hardware and service multipliers
3. Apply hardware throttling if overloaded
4. Calculate project yields (minimum of all services)
5. Apply global service multipliers
6. Subtract recurring costs

### Unlock System

- Trimester-based unlocks (unlockAtTrimester)
- Event-based unlocks (unlockAtEvent)
- Automatic detection and initialization

### Mail System

- Modal-based display
- Game pause when mail is shown
- Option selection with event triggers
- Persistence of mail responses

### UI Features

- Hardware marketplace modal
- Service marketplace modal with version selection
- Service configuration modal
- Real-time stats display
- Terminal-style logging
- Responsive layout
- Status indicators with color coding

## Console Debugging

The game exposes a global object for debugging:

```javascript
// Access config
window.gameRoot.config.hardware
window.gameRoot.config.services
window.gameRoot.config.projects
window.gameRoot.config.mails

// Access runtime state
window.gameRoot.runtime.kouraks
window.gameRoot.runtime.currentNetYield
window.gameRoot.runtime.hardwareInstances
window.gameRoot.runtime.serviceInstances
window.gameRoot.runtime.projectInstances
```

## Testing Checklist

### Hardware Tests

- [x] Open hardware marketplace
- [x] View available hardware
- [x] Deploy hardware (first free item)
- [x] View hardware in deployed list
- [x] Monitor hardware status
- [x] Check hardware load gauge

### Service Tests

- [x] Open service marketplace
- [x] View available services
- [x] View service versions
- [x] Select service for deployment
- [x] Configure service (hardware + project)
- [x] Deploy service
- [x] View service in deployed list
- [x] Monitor service status

### Project Tests

- [x] View active projects
- [x] Check project requirements badges
- [x] Monitor KPI progress
- [x] Track production

### Game Loop Tests

- [x] Kouraks accumulation
- [x] Net yield calculation (positive/negative)
- [x] Trimester progression
- [x] Auto-save functionality

## Known Limitations

- CDN resources may be blocked in restricted environments (use local copies if needed)
- Game requires modern browser with ES6+ support
- LocalStorage required for save/load functionality

## Code Quality

- Code and comments: English
- UI text: French
- Clean separation of concerns (HTML/CSS/JS)
- No build process required
- Modular structure with clear function responsibilities
- Comprehensive error handling
- Terminal logging for debugging

## Implementation Notes

All game mechanics from the specifications are implemented:

- Yield calculation with multipliers and throttling
- Hardware capacity management
- Service-to-hardware assignment
- Project requirements validation
- KPI tracking with strikes
- Crash simulation
- Event system
- Mail system with pause
- Unlock conditions
- Production history tracking
