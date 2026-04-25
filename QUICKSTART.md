# HabitScape - Quick Start Guide

## ⚡ Get Running in 5 Minutes

### Step 1: Set Up Firebase (5 min)
1. Go to https://console.firebase.google.com
2. Click **"Create Project"** → Name it "HabitScape" → Create
3. Click **"Web"** to create a web app
4. Copy your config (6 values)
5. Open `.env.local` in the project root
6. Paste the 6 values next to the corresponding `EXPO_PUBLIC_FIREBASE_*` variables

**Example .env.local:**
```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAbc123...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=habitscape-abc.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=habitscape-abc
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=habitscape-abc.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123def
```

### Step 2: Enable Firestore
1. In Firebase Console, click **"Build" → "Firestore Database"**
2. Click **"Create Database"**
3. Select **"Start in test mode"** (for development)
4. Choose region (default is fine)
5. Click **"Create"**

Done! Your database will be auto-created when you sign up.

### Step 3: Run the App
```bash
cd c:\Users\roger\Desktop\HabitScape\HabitScape
npm start
```

Press:
- **`a`** for Android emulator
- **`w`** for web browser (easiest for testing)
- **`i`** for iOS simulator (macOS only)

### Step 4: Create an Account
1. Click "Sign Up"
2. Enter: email, password, confirm password
3. Click "Create Account"
4. ✅ App initializes 23 skills at level 1

## 🎮 First Test Run

### 1. Add Your First Activity
In Firebase Console Firestore:
1. Go to **Firestore Database**
2. Click **"+"** next to `activities` → New Document
3. Document ID: `weight-lifting`
4. Add fields:
   ```
   activityName: "Weight Lifting"
   baseXP: 100
   cadence: "daily"
   cadenceMultiplier: 1.00
   xpPerCompletion: 100.00
   isActive: true
   skillId: "Strength"
   createdAt: (server timestamp)
   nextResetTime: (tomorrow midnight - use server timestamp)
   ```
5. Save

Alternative: In code, when we add an "Add Activity" feature, users can create activities through the UI.

### 2. Complete an Activity
1. Go to **Activities** tab
2. If activity shows, tap checkbox
3. See XP increase instantly!
4. Go to **Skills** tab → "Strength" should have +100 XP

### 3. Test Real-Time Sync
1. Open the app in two windows/tabs
2. Complete an activity in one
3. Watch the other window update in real-time
4. No refresh needed!

## 📋 Full Feature List

✅ **Implemented (Phase 1 MVP)**
- [x] User signup/login with email
- [x] 23 OSRS skills with XP progression
- [x] Activities checklist (Daily, Weekly, Monthly)
- [x] Real-time XP updates
- [x] Skill progress bars
- [x] OSRS-style skill table
- [x] Offline awareness (requires internet)
- [x] Complete documentation

🔜 **Coming Soon (Phase 2)**
- [ ] Streak counters
- [ ] Custom activity creation
- [ ] Push notifications
- [ ] Activity history

🔜 **Coming Soon (Phase 3)**
- [ ] Avatar creation
- [ ] Character customization
- [ ] Profile page

🔜 **Coming Soon (Phase 4)**
- [ ] Equipment/gear system
- [ ] Milestone unlocks
- [ ] Achievement badges
- [ ] Level 99 capes

## 🐛 Troubleshooting

**Problem: "Firebase configuration is incomplete"**
- Check `.env.local` exists in root directory
- Verify all 6 `EXPO_PUBLIC_FIREBASE_*` values are filled in
- Restart: `npm start`

**Problem: "User not found" during login**
- Make sure you signed up first
- Check email spelling
- Verify user exists in Firebase Auth Console

**Problem: Activities not showing**
- Make sure Firestore document is created correctly
- Field names must match exactly (case-sensitive)
- Check `isActive: true` is set

**Problem: XP not updating**
- Check internet connection (offline not supported)
- Make sure activity completion created in Firestore
- Verify skill field updated with new XP
- Try refreshing the Skills screen

**Problem: Crash on startup**
- Check for red error messages in console
- Common: `.env.local` missing or incomplete
- Try: `npm start` fresh and restart emulator

## 📁 Project Files

Key files to understand:

```
.env.local                        ← Add your Firebase keys HERE
src/
  ├── screens/                    ← 5 main screens
  ├── services/                   ← Firebase operations
  ├── context/                    ← State management
  ├── utils/xpCalculations.ts    ← XP math
  └── constants/                  ← App data (skills, activities, XP table)
```

## 🚀 Next Steps

### After First Test:
1. Create more activities in Firestore
2. Complete multiple activities
3. Watch skills level up
4. Test with different cadences (daily, weekly, etc.)

### Before Phase 2 Development:
1. Get user feedback on current features
2. Test on real devices (not just emulator)
3. Verify Firestore security rules
4. Consider offline sync strategy
5. Plan custom activity creation UI

### To Deploy (Eventually):
1. Switch Firestore to production mode
2. Configure proper security rules
3. Submit to App Store and Google Play
4. Use EAS (Expo Application Services) for building

## 📞 Support

For issues not covered above:
1. Check `SETUP.md` for detailed documentation
2. Check `src/INDEX.ts` for architecture overview
3. Search Firebase Console docs
4. Check React Native/Expo docs

## 🎉 That's it!

You now have a working OSRS-themed fitness tracker! 

Start training your skills like it's Old School RuneScape! 🎮⚔️💪

---

**Status**: Phase 1 MVP Complete ✅
**Last Updated**: April 2026
**Built with**: React Native + TypeScript + Firebase
