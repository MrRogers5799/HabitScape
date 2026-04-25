# Development Notes & Future Considerations

## 🔍 Current Implementation Details

### Real-Time Sync Architecture

The app uses Firebase Firestore listeners for real-time updates:

1. **SkillsContext** listens to `users/{uid}/skills/`
   - Fires whenever ANY skill's XP changes
   - All 23 skills are synced together
   - UI updates automatically

2. **ActivitiesContext** listens to `users/{uid}/activity_completions/`
   - Only listens to completion records
   - Filtered to today's date in UI
   - Updates when activities are checked off

3. **AuthContext** listens to `onAuthStateChanged`
   - Detects login/logout
   - Persists user across app restarts
   - Triggers automatic navigation

### XP Calculation Approach

**Calculation happens on the fly, not stored:**
- Only `totalXP` is stored in Firestore
- `level` is cached in the database but recalculated when displayed
- `progress` is calculated client-side from `totalXP`
- This keeps data normalized and prevents sync issues

**Why not store level?**
- Could get out of sync if XP table changes
- Client can calculate instantly
- Reduces storage space
- Easier to add bonuses later (20% XP boost = instant level recalc)

### Cadence Multiplier Logic

Multipliers ensure fairness across different cadences:

```
Weekly: 0.14 multiplier
- 1 completion = 0.14 × base XP
- 1 per week = 0.14 × 7 = ~0.98 × base XP per week

Daily: 1.00 multiplier
- 1 completion = 1.00 × base XP
- 7 per week = 7.00 × base XP per week

So users get similar weekly XP regardless of cadence chosen.
```

**Important**: Multipliers are **2 decimals** for fair comparison:
- Not rounded up/down, truly representative
- Used as-is: `baseXP × multiplier`

---

## 🐛 Known Limitations (Phase 1 MVP)

1. **No Offline Support**
   - Every action requires internet
   - No local queue for failed operations
   - No sync when coming back online

2. **No Custom Activities (Phase 1)**
   - Users can only use pre-defined activities
   - Activities must be created in Firestore directly
   - Phase 2 will add UI for this

3. **Timezone Handling**
   - Hardcoded to device timezone currently
   - Reset times calculated simply (no daylight saving logic)
   - Should use `date-fns-tz` or `moment-timezone` in Phase 2

4. **No Data Validation**
   - Firestore rules should validate all writes
   - Client-side does some validation
   - Backend validation needed for production

5. **No Rate Limiting**
   - Users can spam activity completion
   - No cooldown between submissions
   - Should be added before public release

6. **No Analytics**
   - No tracking of user behavior
   - No crash reporting
   - Should add Firebase Analytics later

---

## 🚀 Performance Optimizations (Already Done)

✅ **Lazy Listeners**: Listeners only set up when context is used
✅ **Listener Cleanup**: Proper unsubscribe on unmount
✅ **Batch Writes**: Activity completion uses batch for atomicity
✅ **Selective Listening**: Only listen to data you need
✅ **No Extra Re-renders**: Context providers only update when data changes
✅ **Memoized Calculations**: useMemo for skill sections in SkillsHubScreen

## 🔧 Potential Improvements (Phase 2+)

### Backend Improvements
- [ ] Firebase Cloud Functions for validating activity completion
- [ ] Server-side XP calculation (more secure)
- [ ] Automatic daily reset functions
- [ ] Streak calculation cloud function
- [ ] Analytics tracking
- [ ] Activity suggestion algorithm

### Frontend Improvements
- [ ] Add offline support with local caching
- [ ] Implement swipe navigation between tabs
- [ ] Add animations when leveling up
- [ ] Haptic feedback on activity completion
- [ ] Dark/light theme toggle
- [ ] Accessibility improvements (screen reader support)
- [ ] Internationalization (multi-language)

### Feature Improvements
- [ ] Streak counter with milestone rewards
- [ ] Custom activity creation from templates
- [ ] Activity history with charts
- [ ] Friend leaderboards
- [ ] Social sharing (achievements)
- [ ] Notifications for due activities
- [ ] Time zone-aware resets
- [ ] Undo activity completion

---

## 💾 Database Considerations

### Firestore Limitations to Remember

1. **Document Size Limit**: 1 MB max per document
   - Users won't hit this with current schema
   - But activity_completions could grow large

2. **Query Limitations**
   - Can only filter on one inequality
   - Compound queries need multiple indices
   - Could become issue with activity history

3. **Real-time Listener Cost**
   - Each listener = billable read operations
   - Currently 2-3 active listeners per user
   - Should be fine for MVP scale

4. **Batch Write Limit**: 500 operations per batch
   - Currently using 2 operations
   - Fine for MVP
   - Would need refactoring if activity completion becomes complex

### Data Structure Decision

**Why subcollections instead of arrays?**
- `users/{uid}/activity_completions/{id}` is better than storing array in user document
- Allows real-time listeners on just this collection
- Can query and paginate easily
- Doesn't bloat user document

---

## 🔐 Security Considerations

### Current Security (Firebase)
✅ User authentication required
✅ Firestore rules restrict data access
✅ No direct API keys exposed in code
✅ Environment variables for credentials

### Production Checklist
- [ ] Review and update Firestore security rules
- [ ] Enable backup and restore
- [ ] Set up Firebase monitoring
- [ ] Add rate limiting to auth
- [ ] Enable 2FA for Firebase Console
- [ ] Review data retention policies
- [ ] Add data deletion functions
- [ ] Implement GDPR compliance (data export/delete)

---

## 📊 Scalability Notes

### Current Architecture Scales To:
- ~100,000 users (before Firebase billing becomes significant)
- ~1M activity completions (manageable in Firestore)
- Real-time listeners should handle this fine

### What Would Break at Scale:
1. Firestore queries without proper indices
2. Activities collection getting too large
3. Storage of full completion history per user
4. Real-time listeners for global leaderboards
5. Activity recommendations algorithm

### Solutions for Scale:
1. Archive old activity completions to Cloud Storage
2. Use Firestore pagination for large datasets
3. Add caching layer (Redis)
4. Batch Cloud Functions for non-real-time features
5. Move analytics to BigQuery

---

## 🎓 Testing Notes

### Manual Testing Already Done
- ✅ Form validation
- ✅ Auth flows
- ✅ Firestore CRUD
- ✅ Real-time listeners
- ✅ XP calculations
- ✅ UI rendering

### Testing Still Needed
- [ ] Unit tests (jest)
- [ ] Integration tests
- [ ] E2E tests (detox)
- [ ] Performance testing
- [ ] Device-specific testing (different screen sizes)
- [ ] Network condition testing (slow/offline)

### Example Unit Test (for later)
```typescript
// Example test for XP calculation
describe('xpCalculations', () => {
  test('calculateLevel returns 1 for 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  test('calculateLevel returns 99 for max XP', () => {
    expect(calculateLevel(13034431)).toBe(99);
  });

  test('calculateProgress returns 0 at level start', () => {
    expect(calculateProgress(0)).toBe(0);
  });
});
```

---

## 🔄 Git/Version Control

### Current Status
- Initialized with `.gitignore`
- `.env.local` ignored (good!)
- `.env.local.template` tracked (for reference)

### Recommended Commit Strategy
```
feat: Add authentication
feat: Add activities screen
feat: Add real-time sync
fix: Fix XP calculation
docs: Add setup guide
chore: Update dependencies
```

---

## 📱 Mobile Platform Notes

### Android
- Uses React Native defaults
- Tested in emulator
- Should work on Android 8+

### iOS
- Using React Native defaults
- Not tested yet (needs macOS)
- Should work on iOS 13+

### Testing on Physical Devices
1. Download Expo Go app
2. Scan QR code from `npm start` output
3. App loads on device

---

## 🎨 UI/UX Notes

### Design System Used
- **Color Palette**: Dark theme with gold accents (#D4AF37)
- **Typography**: System fonts (default)
- **Spacing**: 4px base unit
- **Components**: Custom built (no UI library)

### Why No UI Library?
- Less dependencies
- Smaller bundle size
- More control over styling
- Can add later if needed

### Accessibility Considerations
- Text sizes are readable
- Touch targets are 44px+ (recommended)
- Colors have sufficient contrast
- Could improve with:
  - Screen reader labels
  - Keyboard navigation
  - Focus indicators

---

## 🚢 Deployment Strategy

### Current Options

**Option 1: Expo (Easiest)**
- Use `eas build` for iOS/Android builds
- Automatic updates via Expo
- Web deployment via `expo export`
- Good for MVP

**Option 2: Native Build**
- Use `expo prebuild`
- Full control over native code
- Can use native modules
- More complex

### Recommended MVP Deployment
1. Use Expo for testing/beta
2. Build native apps with `eas build`
3. Submit to App Store and Google Play
4. Set up staging/production Firebase projects

---

## 💰 Cost Estimates (Firebase)

### Free Tier (Current MVP)
- Auth: ✅ 1M users
- Firestore: ✅ 50k reads/month, 25k writes/month
- Estimated for 100-1000 users: ✅ Fully free

### Small Scale ($0-$10/month)
- 10,000 users
- Moderate activity
- Estimated cost: $2-5/month

### Medium Scale ($10-100/month)
- 100,000 users
- Heavy usage
- Estimated cost: $20-50/month

---

## 🎯 Next Phase Priorities

### Phase 2 (High Priority)
1. Streak system - drives user retention
2. Custom activity creation - user flexibility
3. Notifications - engagement
4. Activity history - user insights

### Phase 3 (Medium Priority)
1. Character creation - personalization
2. Avatar customization - user identity
3. Theme selection - preference

### Phase 4 (Nice to Have)
1. Gear system - progression reward
2. Achievements - gamification
3. Leaderboards - social competition

---

## 📞 Support & Debugging

### Useful Debug Commands

```bash
# Check Firestore data
firebase firestore:documents

# Watch logs
npm run dev

# Clear app cache (React Native)
rm -rf node_modules && npm install

# Reset Expo cache
expo start -c
```

### Common Issues & Solutions

**Issue: "Cannot find module 'src/context/AuthContext'"**
- Solution: Check path aliases in tsconfig.json
- Verify @ maps to src/ directory

**Issue: Listeners never fire**
- Check Firestore security rules
- Verify user is authenticated
- Check collection names match exactly

**Issue: XP not updating in UI**
- Verify Firestore document updated (check Console)
- Check listener is set up (useEffect in context)
- Verify state update happens (console.log in context)

---

## 📚 Resources

### Firebase Docs
- https://firebase.google.com/docs
- https://firebase.google.com/docs/firestore
- https://firebase.google.com/docs/auth

### React Native Docs
- https://reactnative.dev
- https://docs.expo.dev
- https://reactnavigation.org

### OSRS References
- https://oldschool.runescape.wiki
- XP table: https://oldschool.runescape.wiki/w/Experience
- Skill list: https://oldschool.runescape.wiki/w/Skills

---

**Last Updated**: April 12, 2026
**Status**: Phase 1 Complete, Phase 2 Planning
**Confidence Level**: High ✅
