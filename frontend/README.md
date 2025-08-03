# Champion Tatami Control System

A real-time karate competition control system built with Next.js, featuring synchronized timer, score tracking, and penalty management across multiple browser tabs.

## Features

### 🕐 Timer Control

- **Countdown Timer**: Configurable duration (1-20 minutes)
- **Start/Pause/Stop**: Full timer control with pause/resume functionality
- **Visual Progress**: Progress bar showing match completion
- **High Precision**: 16ms update rate for smooth display

### 🥋 Score Management

- **Real-time Scoring**: Instant score updates for both fighters
- **Flexible Points**: Support for -3 to +3 point adjustments
- **Visual Feedback**: Large, clear score display
- **Backend Sync**: Automatic synchronization with tournament API

### ⚠️ Penalty System (Shido)

- **5-Level System**: 0-5 shido tracking per fighter
- **Visual Indicators**: Dot system showing penalty count
- **Real-time Updates**: Synchronized across all displays

### 🔄 Synchronization

- **BroadcastChannel**: Primary communication for same-origin tabs
- **WebSocket Fallback**: Ready for cross-origin communication
- **State Persistence**: LocalStorage backup for page reloads
- **Auto-Sync**: Automatic state synchronization on page load
- **Tournament API**: Real-time sync with external tournament system

## Usage

### Tournament Setup (`/admin/setup`)

- **Tournament Selection**: Choose from available tournaments
- **Navigation**: Continue to tatami-specific setup

### Tatami Setup (`/admin/tatami/[id]/setup`)

- **Bracket Selection**: Choose from brackets assigned to this tatami
- **Match Selection**: Choose from matches with 2 participants
- **Duration Configuration**: Set match duration before starting
- **Match Information**: View selected match details and athletes
- **Navigation**: Proceed to match control after setup

### Match Control (`/admin/tatami/[id]/match/[match_id]`)

- **Timer Control**: Start, pause, stop, and reset match timer
- **Score Management**: Adjust scores for both athletes
- **Shido Tracking**: Manage shido penalties (C1, C2, C3, HC, H)
- **Match Lifecycle**: Start and finish matches with backend integration
- **Time Adjustment**: Adjust remaining time when paused
- **Duration Settings**: Modify match duration before start

### Admin Panel (`/admin/tatami/[id]`)

- **Match Display**: Shows current match and athlete information
- **Timer Controls**: Start, pause, stop, and sync timer
- **Duration Settings**: Configure match length (can be changed before start)
- **Score Management**: Adjust scores for both fighters (syncs with API)
- **Penalty Control**: Set shido levels for each fighter
- **Match Lifecycle**: Start and finish matches with backend integration
- **Manual Sync**: Force synchronization with display screens

### Display Screen (`/screen/tatami/[id]`)

- **Full-Screen Display**: Optimized for large screens/projectors
- **Real-time Updates**: Live timer, scores, and penalties
- **Status Indicators**: Clear fight status (READY/FIGHT/PAUSED)
- **Athlete Names**: Display real competitor names from tournament data
- **Visual Design**: Professional competition display

## Technical Architecture

### Communication

- **Primary**: BroadcastChannel API for same-origin communication
- **Fallback**: WebSocket support for cross-origin scenarios
- **Local**: Zustand store with persistence

### State Management

- **Zustand Store**: Centralized state management
- **LocalStorage**: Automatic persistence across page reloads
- **Message Bus**: Real-time synchronization between tabs

### Data Flow

1. Admin actions update local state
2. Changes broadcast via message bus
3. All connected tabs receive updates
4. Display screens update automatically

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure External API**

   Create a `.env.local` file:

   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   SERVICE_TOKEN=your_service_token_here
   ```

3. **Run Development Server**

   ```bash
   npm run dev
   ```

4. **Access the System**
   - Setup: `http://localhost:3000/admin/setup`
   - Admin: `http://localhost:3000/admin/tatami/1`
   - Display: `http://localhost:3000/screen/tatami/1`

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **BroadcastChannel**: Supported in all modern browsers
- **WebSocket**: Fallback for older browsers or cross-origin

## Backend Integration

The system now integrates with an external tournament API to:

- **Fetch Real Match Data**: Load tournaments, brackets, and matches from the API
- **Display Athlete Names**: Show real competitor names instead of generic "Fighter 1/2"
- **Sync Match Status**: Start and finish matches through the API
- **Update Scores**: Automatically sync score changes with the tournament system
- **Match Lifecycle**: Track match progression (not_started → started → finished)

### API Endpoints Used

- `GET /api/tournaments` - Fetch available tournaments
- `GET /api/tournaments/{id}/brackets` - Get brackets for a tournament
- `GET /api/brackets/{id}/matches` - Get matches for a bracket
- `POST /api/matches/{id}/start` - Start a match
- `POST /api/matches/{id}/finish` - Finish a match with final scores
- `PATCH /api/matches/{id}/scores` - Update match scores

## Future Enhancements

- [ ] WebSocket server for cross-origin communication
- [ ] Multiple tatami support
- [ ] Match history and statistics
- [ ] Sound effects and alerts
- [ ] Authentication for tournament API
- [ ] Real-time match updates from API
- [ ] Mobile-responsive admin interface
- [ ] Export match results
- [ ] Real-time audience display

## Troubleshooting

### Screen Not Updating

1. Check if both tabs are on the same origin
2. Click "Sync" button in admin panel
3. Refresh the screen page
4. Check browser console for errors

### Timer Issues

1. Ensure both tabs are active
2. Check for JavaScript errors
3. Verify localStorage is enabled
4. Try refreshing both pages

### Score/Shido Not Syncing

1. Verify message bus is working
2. Check admin panel for errors
3. Use manual sync button
4. Refresh display screen

## License

MIT License - feel free to use and modify for your karate competitions!
