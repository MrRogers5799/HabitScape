import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, bevel } from '../constants/colors';
import { fonts } from '../constants/typography';

export function VerifyEmailScreen() {
  const { user, logOut, sendVerificationEmail, refreshEmailVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    try {
      setSending(true);
      await sendVerificationEmail();
      setResent(true);
    } catch {
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      setChecking(true);
      const verified = await refreshEmailVerification();
      if (!verified) {
        Alert.alert('Not verified yet', 'We couldn\'t confirm your email yet. Check your inbox and click the link, then try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          A verification link was sent to:
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.body}>
          Open the email and tap the link to verify your account, then come back here and tap the button below.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.primaryBtnText}>I've Verified My Email</Text>
          }
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          onPress={handleResend}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color={colors.gold} />
            : <Text style={styles.secondaryBtnText}>{resent ? 'Email Resent ✓' : 'Resend Verification Email'}</Text>
          }
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.7 }]}
          onPress={logOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  email: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    ...bevel.raised,
  },
  primaryBtnText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.background,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
    ...bevel.raised,
  },
  secondaryBtnText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.gold,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signOutText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
