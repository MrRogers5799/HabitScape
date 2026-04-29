/**
 * Authentication Context
 * 
 * This context provider manages authentication state across the entire app.
 * It provides:
 * - Current user state
 * - Auth functions (signup, login, logout)
 * - Loading and error states
 * 
 * Wrap your app with this provider in App.tsx to enable authentication.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { User as FirebaseUser } from 'firebase/auth';
import {
  signUp as firebaseSignUp,
  logIn as firebaseLogIn,
  logOut as firebaseLogOut,
  onAuthStateChange,
  getUserProfile,
  updateUserDisplayName,
  updateUserTimezone,
  changePassword as firebaseChangePassword,
} from '../services/authService';
import { completeOnboarding as firestoreCompleteOnboarding } from '../services/firestoreService';
import { User, AuthContextType } from '../types';

/**
 * Create the auth context
 * This will be used to provide auth state to the rest of the app
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 * 
 * Wraps your app and manages authentication state.
 * Sets up a Firebase listener on mount to track auth changes.
 * 
 * @param children - React components to wrap
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // State for the currently logged-in user
  const [user, setUser] = useState<User | null>(null);
  // State for loading indicator (during auth operations)
  const [loading, setLoading] = useState(true);
  // State for error messages
  const [error, setError] = useState<string | null>(null);

  /**
   * On mount, set up a Firebase auth state listener
   * This ensures the user stays logged in across app refreshes
   */
  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange(async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // User is logged in - fetch their profile from Firestore
          const userProfile = await getUserProfile(firebaseUser.uid);
          if (userProfile) {
            setUser(userProfile);
          }
        } else {
          // User is logged out
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load user profile');
      } finally {
        // Loading is complete
        setLoading(false);
      }
    });

    // Clean up the listener when component unmounts
    return unsubscribe;
  }, []);

  /**
   * Handle user signup
   * 
   * @param email - User's email
   * @param password - User's password
   * @param timezone - User's timezone
   */
  async function handleSignUp(
    email: string,
    password: string,
    timezone: string
  ): Promise<void> {
    try {
      setError(null);
      setLoading(true);
      await firebaseSignUp(email, password, timezone);
      // User will be automatically set by the auth listener
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle user login
   * 
   * @param email - User's email
   * @param password - User's password
   */
  async function handleLogIn(email: string, password: string): Promise<void> {
    try {
      setError(null);
      setLoading(true);
      await firebaseLogIn(email, password);
      // User will be automatically set by the auth listener
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateDisplayName(displayName: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    await updateUserDisplayName(user.uid, displayName);
    setUser(prev => prev ? { ...prev, displayName } : prev);
  }

  async function handleUpdateTimezone(timezone: string): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    await updateUserTimezone(user.uid, timezone);
    setUser(prev => prev ? { ...prev, timezone } : prev);
  }

  async function handleChangePassword(currentPassword: string, newPassword: string): Promise<void> {
    setError(null);
    await firebaseChangePassword(currentPassword, newPassword);
  }

  async function handleCompleteOnboarding(
    displayName: string,
    activities: { templateId: string; cadence: import('../types').Cadence; skillId: string; baseXP: number }[]
  ): Promise<void> {
    if (!user) throw new Error('Not authenticated');
    await firestoreCompleteOnboarding(user.uid, displayName, activities, user.timezone);
    setUser(prev => prev ? { ...prev, profileComplete: true, displayName: displayName.trim() } : prev);
  }

  /**
   * Handle user logout
   */
  async function handleLogOut(): Promise<void> {
    try {
      setError(null);
      setLoading(true);
      console.log('🔄 Starting logout...');
      await firebaseLogOut();
      console.log('✅ Logout successful, clearing user state');
      setUser(null);
    } catch (err) {
      console.error('❌ Logout error:', err);
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    error,
    signUp: handleSignUp,
    logIn: handleLogIn,
    logOut: handleLogOut,
    updateDisplayName: handleUpdateDisplayName,
    updateTimezone: handleUpdateTimezone,
    changePassword: handleChangePassword,
    completeOnboarding: handleCompleteOnboarding,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 * 
 * Use this in any component to access auth state and functions.
 * Throws an error if used outside of AuthProvider.
 * 
 * @returns AuthContextType with user state and auth functions
 * 
 * @example
 * function MyComponent() {
 *   const { user, loading, signUp } = useAuth();
 *   if (loading) return <Text>Loading...</Text>;
 *   if (!user) return <LoginScreen />;
 *   return <Text>Welcome {user.email}!</Text>;
 * }
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
