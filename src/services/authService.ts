/**
 * Authentication Service
 * 
 * This service handles all Firebase Authentication operations:
 * - User signup (email/password)
 * - User login
 * - User logout
 * - User session management
 * 
 * All auth functions return promises and handle errors gracefully.
 * Errors are thrown and should be caught in the UI components.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged,
  Unsubscribe,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { User } from '../types';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { OSRS_SKILLS } from '../constants/osrsSkills';
import { ACTIVITY_TEMPLATES, DEFAULT_USER_ACTIVITIES } from '../constants/activities';
import { getCadenceMultiplier } from '../constants/cadences';

/**
 * Sign up a new user with email and password
 * 
 * This function:
 * 1. Creates a new Firebase Auth user
 * 2. Creates a user document in Firestore with profile data
 * 3. Initializes all 23 skills with 0 XP
 * 
 * @param email - User's email address
 * @param password - User's password (must be at least 6 characters)
 * @param timezone - User's timezone (e.g., "America/New_York")
 * @returns Promise that resolves when signup is complete
 * @throws Error if signup fails (email already exists, password too weak, etc.)
 */
export async function signUp(
  email: string,
  password: string,
  timezone: string
): Promise<void> {
  try {
    // Step 1: Create Firebase Auth user
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Step 2: Create user document in Firestore
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userData: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      timezone,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      profileComplete: false,
      displayName: '', // Will be set during character creation in Phase 2
    };

    await setDoc(userRef, userData);

    // Step 3: Initialize all skills with 0 XP for this user
    // This ensures the user has all 23 OSRS skills available immediately
    const skillsInitPromises = OSRS_SKILLS.map(skillName => {
      const skillRef = doc(
        db,
        'users',
        firebaseUser.uid,
        'skills',
        skillName
      );
      return setDoc(skillRef, {
        skillName,
        totalXP: 0,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await Promise.all(skillsInitPromises);

    // Step 4: Initialize default activities for this user
    // This creates userActivities documents for each default activity
    const defaultActivitiesPromises = DEFAULT_USER_ACTIVITIES.map(activityId => {
      // Find the activity template
      const template = ACTIVITY_TEMPLATES.find(a => a.id === activityId);
      if (!template) {
        console.warn(`⚠️ Activity template not found: ${activityId}`);
        return Promise.resolve();
      }

      // Use default cadence or first available cadence
      const cadence = template.defaultCadence || template.availableCadences[0];
      const multiplier = getCadenceMultiplier(cadence);
      const xpPerCompletion = template.baseXP * multiplier;

      // Create userActivity document
      const userActivityRef = doc(
        db,
        'users',
        firebaseUser.uid,
        'userActivities',
        template.id
      );
      return setDoc(userActivityRef, {
        id: template.id,
        activityTemplateId: template.id,
        skillId: template.skillId,
        cadence,
        cadenceMultiplier: multiplier,
        xpPerCompletion: Math.round(xpPerCompletion),
        isActive: true,
        selectedAt: new Date(),
        nextResetTime: new Date(), // Will be calculated in the context
      });
    });

    const activityResults = await Promise.all(defaultActivitiesPromises);
    const createdCount = activityResults.filter(r => r !== undefined).length;
    console.log(`✅ User ${email} signed up successfully with ${createdCount} default activities`);
  } catch (error) {
    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes('email-already-in-use')) {
        throw new Error('This email is already registered');
      }
      if (error.message.includes('weak-password')) {
        throw new Error('Password must be at least 6 characters');
      }
      if (error.message.includes('invalid-email')) {
        throw new Error('Please enter a valid email address');
      }
    }
    console.error('❌ Sign up error:', error);
    throw error;
  }
}

/**
 * Log in an existing user with email and password
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise that resolves when login is complete
 * @throws Error if login fails (user not found, wrong password, etc.)
 */
export async function logIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log(`✅ User ${email} logged in successfully`);
  } catch (error) {
    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (
        error.message.includes('user-not-found') ||
        error.message.includes('invalid-credential')
      ) {
        throw new Error('Email or password is incorrect');
      }
      if (error.message.includes('user-disabled')) {
        throw new Error('This account has been disabled');
      }
    }
    console.error('❌ Log in error:', error);
    throw error;
  }
}

/**
 * Log out the currently logged-in user
 * Clears the Firebase Auth session
 * 
 * @returns Promise that resolves when logout is complete
 * @throws Error if logout fails (shouldn't happen in practice)
 */
export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
    console.log('✅ User logged out successfully');
  } catch (error) {
    console.error('❌ Log out error:', error);
    throw error;
  }
}

/**
 * Get the current user object from Firebase Auth
 * 
 * This is a synchronous function that returns the Firebase user object.
 * To react to auth state changes, use onAuthStateChange() instead.
 * 
 * @returns Firebase user object or null if not logged in
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Subscribe to authentication state changes
 * 
 * This function sets up a listener that fires whenever the user logs in or out.
 * Use this in your app's root to maintain auth state across the entire app.
 * 
 * @param callback - Function called with the user whenever auth state changes
 * @returns Unsubscribe function to stop listening to changes
 * 
 * @example
 * const unsubscribe = onAuthStateChange((user) => {
 *   if (user) {
 *     console.log('User logged in:', user.email);
 *   } else {
 *     console.log('User logged out');
 *   }
 * });
 * // Later, when you want to stop listening:
 * unsubscribe();
 */
export function onAuthStateChange(
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  // Set up the listener
  const unsubscribe = onAuthStateChanged(auth, callback);
  return unsubscribe;
}

/**
 * Get a user's profile data from Firestore
 * 
 * This retrieves the user document that was created during signup.
 * It includes timezone, display name, and other profile information.
 * 
 * @param uid - The user's Firebase UID
 * @returns User profile object, or null if user not found
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn(`User profile not found for UID: ${uid}`);
      return null;
    }

    // Convert Firestore timestamps to JavaScript Dates
    const data = userDoc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      lastLoginAt: data.lastLoginAt?.toDate?.() || new Date(),
    } as User;
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Validate email format
 * Simple client-side validation before sending to Firebase
 * 
 * @param email - Email to validate
 * @returns true if email appears valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Firebase requires at least 6 characters, but we can enforce stronger requirements
 * 
 * @param password - Password to validate
 * @returns Object with isValid and message
 */
export function validatePassword(
  password: string
): { isValid: boolean; message: string } {
  if (password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters',
    };
  }
  return { isValid: true, message: '' };
}
