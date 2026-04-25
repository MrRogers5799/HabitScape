/**
 * INDEX FILE - Project Structure Overview
 * 
 * This file documents the complete project structure for HabitScape.
 * It serves as a quick reference for navigating the codebase.
 */

// ============================================================================
// PROJECT STRUCTURE
// ============================================================================

/*
HabitScape/
├── src/
│   ├── screens/
│   │   ├── AuthScreen.tsx              # Login/signup UI
│   │   ├── ActivitiesScreen.tsx        # Activity checklist with real-time sync
│   │   ├── SkillsHubScreen.tsx         # OSRS-style skills table
│   │   ├── SettingsScreen.tsx          # User settings and logout
│   │   └── ProfileScreen.tsx           # Profile placeholder (Phase 2)
│   │
│   ├── components/
│   │   └── ProgressBar.tsx             # Visual progress bar component
│   │
│   ├── services/
│   │   ├── firebase.ts                 # Firebase initialization
│   │   ├── authService.ts              # Auth operations (signup, login, logout)
│   │   └── firestoreService.ts         # Firestore CRUD operations
│   │
│   ├── context/
│   │   ├── AuthContext.tsx             # Auth state provider
│   │   ├── SkillsContext.tsx           # Skills state + real-time listener
│   │   └── ActivitiesContext.tsx       # Activities state + real-time listener
│   │
│   ├── types/
│   │   └── index.ts                    # All TypeScript type definitions
│   │
│   ├── utils/
│   │   └── xpCalculations.ts           # XP calculation utilities
│   │
│   ├── constants/
│   │   ├── osrsSkills.ts               # All 23 OSRS skills with icons
│   │   ├── xpTable.ts                  # XP progression table (1-99)
│   │   ├── activities.ts               # Pre-defined activities
│   │   └── cadences.ts                 # Cadence options and multipliers
│   │
│   └── navigation/
│       └── RootNavigator.tsx           # Navigation structure
│
├── app/
│   ├── _layout.tsx                     # Root layout with all providers
│   └── (other routes - not used in MVP)
│
├── .env.local                          # Firebase credentials (DO NOT COMMIT)
├── .env.local.template                 # Template for .env.local
├── SETUP.md                            # Detailed setup instructions
├── app.json                            # Expo app configuration
├── package.json                        # Dependencies
└── tsconfig.json                       # TypeScript configuration

// ============================================================================
// KEY FILES & THEIR PURPOSES
// ============================================================================

SCREENS (User Interface)
├── AuthScreen.tsx
│   Purpose: Handle user login and signup
│   Features: Email/password input, form validation, timezone selection
│   State: Uses useAuth() context
│
├── ActivitiesScreen.tsx
│   Purpose: Display activities checklist, handle completion
│   Features: Organized by cadence, real-time XP updates, checkboxes
│   State: Uses useActivities() and useAuth() contexts
│   Real-time: Listens to activity_completions collection
│
├── SkillsHubScreen.tsx
│   Purpose: Display all skills in OSRS-style table
│   Features: Level display, XP, progress bars, sections by level range
│   State: Uses useSkills() context
│   Real-time: Listens to skills collection
│
├── SettingsScreen.tsx
│   Purpose: User settings and account management
│   Features: Display email/timezone, logout button
│   State: Uses useAuth() context
│
└── ProfileScreen.tsx
    Purpose: Placeholder for character creation
    Features: Account status display, Phase 2/3 coming soon messages
    Future: Will include avatar creation, gear display

SERVICES (Backend Integration)
├── firebase.ts
│   Purpose: Initialize Firebase with credentials
│   Key: Exports auth and db instances
│   Security: Uses .env.local for credentials
│
├── authService.ts
│   Purpose: Firebase Authentication operations
│   Exports:
│     - signUp(email, password, timezone)
│     - logIn(email, password)
│     - logOut()
│     - onAuthStateChange(callback)
│     - getUserProfile(uid)
│   Features: Form validation, user profile creation, skill initialization
│
└── firestoreService.ts
    Purpose: Firestore database operations
    Exports:
      - getSkills(userId)
      - subscribeToSkills(userId, callback)
      - getActivities(userId, cadenceFilter?)
      - createActivity(userId, ...)
      - completeActivity(userId, activityId)  [CORE FUNCTION]
      - getActivityCompletions(userId)
      - subscribeToActivityCompletions(userId, callback)

CONTEXT PROVIDERS (State Management)
├── AuthContext.tsx
│   Purpose: Manage user authentication state
│   Provides:
│     - user: User | null
│     - loading: boolean
│     - error: string | null
│     - signUp, logIn, logOut functions
│   Setup: Firestore listener on mount to persist auth
│
├── SkillsContext.tsx
│   Purpose: Manage skills data and real-time sync
│   Provides:
│     - skills: Skill[]
│     - loading: boolean
│     - error: string | null
│     - refreshSkills(): Promise<void>
│     - getSkill(skillId): Skill | undefined
│   Real-time: Listens to user_skills collection
│   Depends on: AuthContext (for user.uid)
│
└── ActivitiesContext.tsx
    Purpose: Manage activities and completions
    Provides:
      - activities: Activity[]
      - completedToday: ActivityCompletion[]
      - loading: boolean
      - error: string | null
      - completeActivity(activityId): Promise<void>
      - refreshActivities(): Promise<void>
      - getActivitiesByCadence(cadence): Activity[]
    Real-time:
      - Listens to activities collection on load
      - Listens to activity_completions collection for today's completions
    Depends on: AuthContext (for user.uid)

TYPES (TypeScript Definitions)
├── User
│   uid, email, displayName, timezone, createdAt, lastLoginAt, profileComplete
│
├── Skill
│   id, skillName, totalXP, level, createdAt, updatedAt
│
├── Activity
│   id, activityName, skillId, baseXP, cadence, cadenceMultiplier,
│   xpPerCompletion, isActive, createdAt, nextResetTime
│
├── ActivityCompletion
│   id, activityId, skillId, completedAt, xpEarned, metadata
│
├── Context Types: AuthContextType, SkillsContextType, ActivitiesContextType

UTILITIES (Helper Functions)
└── xpCalculations.ts
    Functions:
      - calculateLevel(totalXP): number [1-99]
      - calculateXPToNextLevel(totalXP): number
      - calculateCurrentLevelXP(totalXP): number
      - calculateLevelXPRange(totalXP): number
      - calculateProgress(totalXP): number [0-100%]
      - formatXP(xp): string [with commas]
      - getXPStats(totalXP): object [all stats at once]

CONSTANTS (Configuration)
├── osrsSkills.ts
│   OSRS_SKILLS: All 23 skill names
│   SKILL_DESCRIPTIONS: What each skill represents
│   SKILL_ICONS: Emoji icons for display
│
├── xpTable.ts
│   XP_TABLE: XP required for each level 1-99
│   Functions: isValidXP(), getMaxXP(), getAllLevels()
│
├── activities.ts
│   ACTIVITY_TEMPLATES: 15+ pre-defined activities
│   Functions: getActivityTemplate(), getActivitiesForSkill(), getDefaultCadence()
│
└── cadences.ts
    CADENCE_CONFIG: Cadence options with multipliers
    Functions:
      - getCadenceMultiplier(cadence): number
      - getCadenceLabel(cadence): string
      - calculateXPPerCompletion(baseXP, cadence): number
      - calculateNextResetTime(cadence, timezone): Date
      - isValidCadence(cadence): boolean

// ============================================================================
// DATA FLOW EXAMPLES
// ============================================================================

USER SIGNUP FLOW:
1. User fills email, password, timezone in AuthScreen
2. Clicks "Create Account"
3. AuthScreen calls useAuth().signUp(email, password, timezone)
4. authService.signUp():
   - Creates Firebase Auth user
   - Creates users/{uid} doc in Firestore with profile
   - Creates 23 skills/{skillName} docs with 0 XP each
5. onAuthStateChange listener in AuthContext detects new user
6. AuthContext updates user state
7. Navigation automatically switches to App (TabNavigator)
8. SkillsProvider sets up listener on mount
9. ActivitiesProvider sets up listener on mount
10. User sees empty skills (all level 1) and no activities yet

ACTIVITY COMPLETION FLOW:
1. User sees Activities screen with daily activities
2. User taps checkbox on "Weight Lifting" activity
3. ActivitiesScreen calls useActivities().completeActivity(activityId)
4. firestoreService.completeActivity():
   - Gets activity document (skillId: "Strength", xpPerCompletion: 43.0)
   - Gets current skill document (totalXP: 5000)
   - Creates activity_completions doc with xpEarned: 43.0
   - Updates skill doc with totalXP: 5043
5. Firebase listener detects skill change
6. SkillsContext state updates with new skills data
7. SkillsHubScreen listening to SkillsContext re-renders
8. User sees XP increased from 5000 to 5043 instantly
9. calculateLevel() recalculates, level might increase if XP threshold passed
10. Both Activities and Skills screens show updated progression

REAL-TIME MULTI-SCREEN UPDATE:
1. User has both ActivitiesScreen (tab 1) and SkillsHubScreen (tab 2) open
2. User on ActivitiesScreen, completes activity
3. Firebase updates skill XP
4. subscribeToSkills listener fires in SkillsContext
5. SkillsContext updates state
6. SkillsHubScreen re-renders with new XP (even if not currently visible)
7. User switches to SkillsHubScreen
8. Sees the updated XP instantly (was updated in real-time)

// ============================================================================
// FIREBASE SECURITY RULES (Recommended)
// ============================================================================

{
  "rules": {
    "users": {
      "{uid}": {
        ".read": "request.auth.uid == uid",
        ".write": "request.auth.uid == uid",
        "skills": {
          "{skillName}": {
            ".read": "request.auth.uid == uid",
            ".write": "request.auth.uid == uid"
          }
        },
        "activities": {
          "{activityId}": {
            ".read": "request.auth.uid == uid",
            ".write": "request.auth.uid == uid"
          }
        },
        "activity_completions": {
          "{completionId}": {
            ".read": "request.auth.uid == uid",
            ".write": "request.auth.uid == uid"
          }
        }
      }
    }
  }
}

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

SETUP:
 [ ] Created Firebase project
 [ ] Added Web app to Firebase project
 [ ] Created Firestore database
 [ ] Copied credentials to .env.local
 [ ] npm install completed
 [ ] npm start runs without errors

AUTHENTICATION:
 [ ] Sign up page displays
 [ ] Email validation works
 [ ] Password validation works
 [ ] Can create new account
 [ ] User doc created in Firestore with correct data
 [ ] 23 skills created with 0 XP
 [ ] Can log in with created account
 [ ] Can log out

SKILLS HUB:
 [ ] All 23 skills visible
 [ ] Skills grouped by level ranges
 [ ] Each skill shows: Level X/99, Total XP, XP to next, progress bar
 [ ] Level correctly calculated from XP
 [ ] Progress bar shows correct percentage
 [ ] XP formatted with commas

ACTIVITIES:
 [ ] Activities display (if any created)
 [ ] Activities grouped by cadence (Daily, Weekly, Monthly)
 [ ] Each activity shows: name, skill, XP value
 [ ] Checkbox can be tapped
 [ ] Activity completion shows in Firestore

XP & PROGRESSION:
 [ ] Complete activity → see XP increase in real-time
 [ ] Skill level increases when reaching XP threshold
 [ ] Progress bar updates
 [ ] Skills Hub updates when activity completed
 [ ] Activities and Skills screens sync in real-time

REAL-TIME SYNC:
 [ ] Open two browser tabs/emulator instances
 [ ] Complete activity in one
 [ ] Other instance shows update without refresh
 [ ] Switch between tabs and see updates persist

SESSION PERSISTENCE:
 [ ] Log out
 [ ] Close and reopen app
 [ ] User still logged in
 [ ] Skills data persists
 [ ] Activities data persists

ERROR HANDLING:
 [ ] Invalid email shows error
 [ ] Password too short shows error
 [ ] Passwords don't match shows error
 [ ] Network error shows message
 [ ] Can retry failed operations

// ============================================================================
// NEXT STEPS (Phase 2+)
// ============================================================================

PHASE 2: STREAKS & CUSTOM ACTIVITIES
- Add streak counters to activities
- Allow users to create custom activities from templates
- Add push notifications
- Activity history with filters

PHASE 3: CHARACTER CREATION
- Avatar creation screen
- Username selection
- Appearance customization
- Character profile display

PHASE 4: GEAR & MILESTONES
- Equipment unlocks at level milestones
- XP multiplier items
- Achievement system
- Level 99 skill capes

// ============================================================================
// IMPORTANT NOTES
// ============================================================================

1. NEVER commit .env.local with real Firebase credentials
   - Add to .gitignore (already done)
   - Use .env.local.template for documentation

2. Real-time listeners are set up in context providers
   - Automatically clean up on unmount
   - Multiple components can use same context
   - No duplicate listeners

3. Activity completion triggers atomic Firestore batch write
   - Ensures activity_completion and skill XP update together
   - No partial updates

4. All XP tables and multipliers use exact OSRS formulas
   - Ensures consistency with OSRS progression
   - Multipliers limited to 2 decimals for fairness

5. TypeScript strict mode enabled
   - All types must be explicitly defined
   - Catch errors at compile time

6. Dark theme hardcoded (OSRS aesthetics)
   - Primary color: #D4AF37 (gold)
   - Background: #1a1a1a (dark gray)
   - Text: #fff (white)
*/

export const PROJECT_STRUCTURE = 'See comments above for complete overview';
