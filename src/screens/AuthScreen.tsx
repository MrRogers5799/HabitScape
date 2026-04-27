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

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Animated,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';

const TAGLINES = [
  'Level up your real life.',
  'Train hard. Level up. Repeat.',
  'Your grind starts here.',
  'Build legendary habits.',
  'One XP at a time.',
  "The greatest journey begins with 1 XP.",
];
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { isValidEmail, validatePassword } from '../services/authService';
import { COMMON_TIMEZONES, getDefaultTimezone } from '../constants/timezones';

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

  // Cycling tagline
  const [taglineIndex, setTaglineIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setTaglineIndex(prev => (prev + 1) % TAGLINES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 3500);
    return () => clearInterval(cycle);
  }, []);

  // UI state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
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
          <Text style={styles.title}>HabitScape</Text>
          <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
            {TAGLINES[taglineIndex]}
          </Animated.Text>
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
              <TouchableOpacity
                style={styles.timezoneButton}
                onPress={() => setTimezonePickerVisible(true)}
                disabled={isLoading}
              >
                <Text style={styles.timezoneButtonText}>
                  {COMMON_TIMEZONES.find(tz => tz.value === timezone)?.label ?? timezone}
                </Text>
                <Text style={styles.timezoneChevron}>›</Text>
              </TouchableOpacity>
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

      {/* Timezone Picker Modal */}
      <Modal
        visible={timezonePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Timezone</Text>
              <TouchableOpacity onPress={() => setTimezonePickerVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {COMMON_TIMEZONES.map(tz => (
                <TouchableOpacity
                  key={tz.value}
                  style={[
                    styles.timezoneOption,
                    timezone === tz.value && styles.timezoneOptionSelected,
                  ]}
                  onPress={() => {
                    setTimezone(tz.value);
                    setTimezonePickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.timezoneLabel,
                    timezone === tz.value && styles.timezoneLabelSelected,
                  ]}>
                    {tz.label}
                  </Text>
                  <Text style={styles.timezoneValue}>{tz.value}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.gold,
    marginBottom: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  timezoneButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timezoneButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  timezoneChevron: {
    color: colors.textSecondary,
    fontSize: 20,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 16,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  timezoneOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  timezoneOptionSelected: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  timezoneLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  timezoneLabelSelected: {
    color: colors.gold,
  },
  timezoneValue: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: '#3d1a0e',
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorMessage: {
    color: colors.errorText,
    fontSize: 13,
  },
  authButton: {
    backgroundColor: colors.gold,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleText: {
    color: colors.gold,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: colors.textDisabled,
    fontSize: 12,
  },
});
