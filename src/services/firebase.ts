/**
 * Firebase Configuration
 * 
 * This file initializes Firebase with your project credentials.
 * Credentials are loaded from environment variables for security.
 * 
 * DO NOT commit actual Firebase keys to version control!
 * 
 * To set up:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Create a new Web app in your project
 * 3. Copy your credentials from the Firebase console
 * 4. Create a .env.local file in the project root with:
 *    - EXPO_PUBLIC_FIREBASE_API_KEY
 *    - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
 *    - EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *    - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 *    - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *    - EXPO_PUBLIC_FIREBASE_APP_ID
 * 
 * (Prefix with EXPO_PUBLIC_ so Expo CLI can access them)
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase configuration object
 * Values are loaded from environment variables set in .env.local
 */
const firebaseConfig = {
  // Your Firebase API key
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  // Your Firebase auth domain
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // Your Firebase project ID
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  // Your Firebase storage bucket
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  // Your Firebase messaging sender ID
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // Your Firebase app ID
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Validate that all required Firebase config values are present
 * Throws an error if any values are missing
 */
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is incomplete!');
  console.error('Please set environment variables in .env.local');
  console.error('See comments in src/services/firebase.ts for setup instructions');
  throw new Error(
    'Firebase configuration incomplete. Check your .env.local file.'
  );
}

/**
 * Initialize Firebase app
 * This creates a single Firebase instance that's used throughout the app
 */
const app = initializeApp(firebaseConfig);

/**
 * Initialize Firebase Authentication
 * Used for user signup, login, and logout
 */
export const auth = getAuth(app);

/**
 * Initialize Firestore Database
 * Used for storing and syncing user data in real-time
 */
export const db = getFirestore(app);

/**
 * Export the app instance for any additional Firebase services
 */
export default app;
