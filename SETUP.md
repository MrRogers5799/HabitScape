# HabitScape 🎮

Train your real-life skills like it's Old School RuneScape.

A fitness and wellness tracker app themed after Old School RuneScape, combining habit tracking with OSRS skill progression mechanics.

## Features (Phase 1 MVP)

✅ **User Authentication**
- Email/password signup and login
- Firebase Authentication integration
- Timezone selection for activity resets

✅ **Activities Tracking**
- Check off daily, weekly, and monthly activities
- Pre-defined activities linked to OSRS skills
- Real-time XP updates when activities are completed
- Cadence-based XP scaling for fairness

✅ **Skills Hub**
- OSRS-style skills menu showing all 23 skills
- Current level (1-99) display
- Total XP with comma formatting
- Visual progress bar to next level
- Real-time skill progression

✅ **Real-Time Sync**
- Firebase Firestore real-time listeners
- Instant XP updates across screens
- Automatic skill level calculations
- Offline-aware (requires internet for actions)

## Architecture

```
┌─ src/
│  ├─ screens/          # Screen components (Auth, Activities, Skills, etc.)
│  ├─ components/       # Reusable UI components (ProgressBar, etc.)
│  ├─ services/         # Firebase services (auth, Firestore)
│  ├─ context/          # React Context providers (Auth, Skills, Activities)
│  ├─ types/            # TypeScript type definitions
│  ├─ utils/            # Utility functions (XP calculations)
│  └─ constants/        # App constants (skills, XP table, cadences)
├─ app/                 # Expo Router app directory
├─ package.json         # Dependencies
├─ .env.local           # Firebase credentials (NOT in git)
└─ tsconfig.json        # TypeScript config
```

## Tech Stack

- **Frontend**: React Native + TypeScript (via Expo)
- **Navigation**: React Navigation with bottom tabs
- **Backend**: Firebase (Authentication + Firestore)
- **Hosting**: Expo (for OTA updates)

## Prerequisites

- Node.js 16+ and npm 7+
- Expo CLI: `npm install -g expo-cli`
- Firebase account (free tier supported)
- Android Emulator or physical device (or iOS with macOS)

## Setup Instructions

### 1. Clone/Setup Project

```bash
# Navigate to the project
cd c:\Users\roger\Desktop\HabitScape\HabitScape

# Install dependencies
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Create a **Web App** in your project
4. Copy the Firebase config values
5. Paste them into `.env.local`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Configure Firestore

In Firebase Console:

1. Create a **Firestore Database** (start in test mode)
2. Keep default settings
3. Let the app create collections automatically on first signup

### 4. Run the App

```bash
# Start Expo development server
npm start

# For Android: press 'a'
# For iOS: press 'i' (macOS only)
# For web: press 'w'
```

## Project Structure Details

### Type Definitions (`src/types/index.ts`)
- `User`, `Skill`, `Activity`, `ActivityCompletion`
- Context types: `AuthContextType`, `SkillsContextType`, `ActivitiesContextType`
- Cadence type: `'daily' | '3x/week' | '2x/week' | 'weekly' | 'monthly'`

### Constants
- **`osrsSkills.ts`**: All 23 OSRS skill names with icons and descriptions
- **`xpTable.ts`**: Exact OSRS XP progression (0 to 13,034,431 for level 99)
- **`activities.ts`**: Pre-defined activities (Weight Lifting, Running, etc.)
- **`cadences.ts`**: Cadence options with XP multipliers for fairness

### Services
- **`authService.ts`**: Firebase Auth (signup, login, logout, user profile)
- **`firestoreService.ts`**: Firestore CRUD operations
  - Skills: getSkills, subscribeToSkills
  - Activities: getActivities, createActivity, completeActivity
  - Completions: getActivityCompletions, subscribeToActivityCompletions

### Context Providers
- **`AuthContext.tsx`**: Manages current user and auth state
- **`SkillsContext.tsx`**: Real-time skills data and calculations
- **`ActivitiesContext.tsx`**: Activities list and completion tracking

### Utility Functions
- **`xpCalculations.ts`**:
  - `calculateLevel(totalXP)` - Get level from XP
  - `calculateXPToNextLevel(totalXP)` - XP remaining to next level
  - `calculateProgress(totalXP)` - Progress % (0-100)
  - `formatXP(xp)` - Format with commas for display

## XP System

### XP Scaling for Fairness

Activities are scaled by cadence so 7 daily activities = 1 weekly activity (in time):

| Cadence | Multiplier | Example |
|---------|-----------|---------|
| Daily (7x/week) | 1.00 | 100 XP/day |
| 5x/week | 0.71 | 71 XP each |
| 3x/week | 0.43 | 43 XP each |
| Weekly | 0.14 | 14 XP each |
| Monthly | 0.04 | 4 XP each |

### Level Progression

- All skills use the same XP table
- Level 1 = 0 XP
- Level 99 = 13,034,431 XP
- Progression based on OSRS formula
- ~100-120 days to max a skill doing daily activities

## Screens

### 1. Auth Screen
- Email/password login
- Sign up with timezone selection
- Form validation
- Error display

### 2. Activities Screen
- Organized by cadence (Daily, Weekly, Monthly)
- Checkboxes to complete activities
- Shows completed count per section
- Real-time sync: check activity → XP added → skill updated

### 3. Skills Hub Screen
- OSRS-style skill table
- Skills grouped by level ranges
- Shows: Level X/99, Total XP, XP to next level, progress bar
- Real-time updates as XP changes

### 4. Settings Screen
- Display current email and timezone
- Logout button
- Phase 2 upcoming features

### 5. Profile Screen
- Account status
- Character creation placeholder (Phase 2)
- Equipment/gear placeholder (Phase 3)

## Firebase Firestore Schema

### Collection: `users/{userId}`
```
{
  uid: string,
  email: string,
  displayName: string,
  timezone: string,
  createdAt: timestamp,
  lastLoginAt: timestamp,
  profileComplete: boolean
}
```

### Subcollection: `users/{userId}/skills/{skillId}`
```
{
  skillName: string,
  totalXP: number,
  level: number (cached),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Subcollection: `users/{userId}/activities/{activityId}`
```
{
  activityName: string,
  skillId: string,
  baseXP: number,
  cadence: string,
  cadenceMultiplier: number,
  xpPerCompletion: number,
  isActive: boolean,
  createdAt: timestamp,
  nextResetTime: timestamp
}
```

### Subcollection: `users/{userId}/activity_completions/{id}`
```
{
  activityId: string,
  skillId: string,
  completedAt: timestamp,
  xpEarned: number,
  metadata: object
}
```

## Development Notes

### Real-Time Sync Flow

1. User checks off activity on Activities screen
2. `completeActivity(activityId)` called
3. Firebase Firestore writes:
   - New `activity_completions` document
   - Updates skill's `totalXP` field
4. Firebase listener detects change
5. React state updates automatically
6. UI re-renders with new XP and level

### Error Handling

- Network errors show user-friendly messages
- Form validation before API calls
- Firebase errors caught and displayed
- Retry buttons on error states

### Performance Considerations

- Skills listener: Fires whenever any skill changes
- Completions listener: Only listens to today's completions
- Real-time updates: Automatic via Firestore listeners
- No polling - fully event-driven

## Testing

### Manual Testing Checklist

- [ ] Sign up with new email
- [ ] All 23 skills initialized with 0 XP
- [ ] Create an activity
- [ ] Complete an activity
- [ ] See XP update in real-time on Skills Hub
- [ ] Log out and log back in
- [ ] Skills persist across sessions
- [ ] Switch between Activity and Skills screens
- [ ] See real-time updates when opening Skills screen

### Test Credentials

After setup, create test user:
- Email: `test@example.com`
- Password: `testpass123`

## Future Phases

### Phase 2: Streaks & Custom Activities
- Streak counters for activities
- Allow custom activities from templates
- Push notifications for reminders
- Activity history per skill

### Phase 3: Character Creation
- Avatar customization
- Player name/username
- Theme selection
- Profile customization

### Phase 4: Gear & Milestones
- Equipment unlocks at level milestones
- XP multiplier items
- Achievement badges
- Level-99 skill capes

## Troubleshooting

### "Firebase configuration incomplete"
- Check `.env.local` exists
- Verify all EXPO_PUBLIC_FIREBASE_* variables set
- Restart Expo dev server: `npm start`

### "User not found" or "Invalid credential"
- Check email/password in Firebase Console
- Verify user was created successfully
- Check database rules allow auth

### Activities not appearing
- Ensure user created activities
- Check Firestore `activities` collection exists
- Verify `isActive: true` for activities

### XP not updating
- Check internet connection (offline not supported)
- Verify activity completion record created in Firestore
- Check skill's XP field updated
- Refresh Skills Hub screen

### Real-time updates not working
- Verify Firestore security rules allow reads
- Check browser console for errors
- Restart Expo dev server
- Reload app on device/emulator

## Contributing

This is a personal project. For feature requests or issues, document them for future phases.

## License

MIT

## Credits

- Old School RuneScape® - Inspiration for skill mechanics and aesthetics
- Firebase - Backend infrastructure
- React Native & Expo - Mobile framework
- React Navigation - Navigation library

---

**Built by**: Roger
**Project**: HabitScape MVP v1.0
**Last Updated**: April 2026
