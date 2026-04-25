/**
 * Login/Register Screen
 * 
 * Handles user authentication - both login and signup.
 * Features:
 * - Email and password input validation
 * - Toggle between login and signup modes
 * - Timezone selection for signup
 * - Error message display
 * - Loading state
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  isValidEmail,
  validatePassword,
} from '../services/authService';

interface AuthScreenProps {
  /** Optional: function to call when auth is complete */
  onAuthSuccess?: () => void;
}

/**
 * Auth Screen Component
 * Displays login/signup form
 */
export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  // Auth state
  const { logIn, signUp, loading, error: contextError } = useAuth();

  // UI state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [localLoading, setLocalLoading] = useState(false);

  /**
   * Validate form inputs
   */
  function validateForm(): boolean {
    const newErrors: { [key: string]: string } = {};

    // Check email
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    // Check password
    if (!password) {
      newErrors.password = 'Password is required';
    } else {
      const validation = validatePassword(password);
      if (!validation.isValid) {
        newErrors.password = validation.message;
      }
    }

    // Additional checks for signup
    if (isSignUp) {
      if (!passwordConfirm) {
        newErrors.passwordConfirm = 'Please confirm your password';
      } else if (password !== passwordConfirm) {
        newErrors.passwordConfirm = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /**
   * Handle login
   */
  async function handleLogin() {
    if (!validateForm()) return;

    try {
      setLocalLoading(true);
      await logIn(email, password);
      // Navigation will happen automatically when user state updates
      onAuthSuccess?.();
    } catch (err) {
      // Error is already shown via contextError
    } finally {
      setLocalLoading(false);
    }
  }

  /**
   * Handle signup
   */
  async function handleSignUp() {
    if (!validateForm()) return;

    try {
      setLocalLoading(true);
      await signUp(email, password, timezone);
      // Navigation will happen automatically when user state updates
      onAuthSuccess?.();
    } catch (err) {
      // Error is already shown via contextError
    } finally {
      setLocalLoading(false);
    }
  }

  /**
   * Handle auth button press
   */
  function handleAuthPress() {
    if (isSignUp) {
      handleSignUp();
    } else {
      handleLogin();
    }
  }

  const isLoading = loading || localLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🎮 HabitScape</Text>
          <Text style={styles.subtitle}>
            Train your real-life skills like it's Old School RuneScape
          </Text>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Password Confirmation (signup only) */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.passwordConfirm ? styles.inputError : null,
                ]}
                placeholder="Confirm your password"
                placeholderTextColor="#999"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                secureTextEntry
                editable={!isLoading}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.passwordConfirm && (
                <Text style={styles.errorText}>{errors.passwordConfirm}</Text>
              )}
            </View>
          )}

          {/* Timezone Selection (signup only) */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Timezone</Text>
              <Text style={styles.timezoneValue}>{timezone}</Text>
              <Text style={styles.timezoneHint}>
                (Customize after login if needed)
              </Text>
            </View>
          )}

          {/* Context Error Display */}
          {contextError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorMessage}>❌ {contextError}</Text>
            </View>
          )}

          {/* Auth Button */}
          <TouchableOpacity
            style={[styles.authButton, isLoading ? styles.authButtonDisabled : null]}
            onPress={handleAuthPress}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.authButtonText}>
                {isSignUp ? 'Create Account' : 'Log In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle Mode Button */}
          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setErrors({});
            }}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>
              {isSignUp
                ? 'Already have an account? Log In'
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Phase 1 MVP</Text>
          <Text style={styles.footerText}>© 2026 HabitScape</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
  },
  timezoneValue: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  timezoneHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#3d1f1f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  errorMessage: {
    color: '#ff9999',
    fontSize: 13,
  },
  authButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleText: {
    color: '#D4AF37',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
  },
});
