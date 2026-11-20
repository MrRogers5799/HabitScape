/**
 * The new version's log in / sign up screen (PROD-024, PROD-025): the dusk valley
 * scene behind a kit panel. Same account flow as the live AuthScreen (log in, sign up
 * with a timezone, password reset). Shown only in development builds until launch.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail, validatePassword, sendPasswordReset } from '../../services/authService';
import { COMMON_TIMEZONES, getDefaultTimezone } from '../../constants/timezones';
import { FRAMES, KitButton, kitColors, kitFonts, NineSlice, Panel, space, type } from '../../game-ui';

const SCENE = require('../../../assets/game-ui/scenes/login.png');

function Field({ value, onChange, placeholder, secure, error, right, editable, keyboardType }: {
  value: string; onChange: (t: string) => void; placeholder: string; secure?: boolean; error?: string;
  right?: React.ReactNode; editable: boolean; keyboardType?: 'email-address';
}) {
  return (
    <View style={{ gap: space.xxs }}>
      <NineSlice frame={FRAMES.slot} padding={space.xxs} style={[styles.field, !!error && styles.fieldError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={kitColors.textFaint}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          editable={editable}
          accessibilityLabel={placeholder}
        />
        {right}
      </NineSlice>
      {!!error && <Text style={[type.caption, { color: kitColors.red }]}>{error}</Text>}
    </View>
  );
}

export function KitAuthScreen() {
  const { logIn, signUp, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [pickTimezone, setPickTimezone] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLoading = loading || busy;

  const clearMessages = () => { setFormError(null); setFormInfo(null); };

  function switchMode() {
    setIsSignUp((v) => !v);
    setErrors({});
    clearMessages();
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Enter your email';
    else if (!isValidEmail(email)) e.email = 'That email doesn’t look right';
    if (!password) e.password = 'Enter your password';
    else {
      const v = validatePassword(password);
      if (!v.isValid) e.password = v.message;
    }
    setErrors(e);
    return !e.email && !e.password;
  }

  async function submit() {
    if (!validate()) return;
    clearMessages();
    try {
      setBusy(true);
      if (isSignUp) await signUp(email, password, timezone);
      else await logIn(email, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    clearMessages();
    if (!email.trim() || !isValidEmail(email)) {
      setErrors({ email: 'Enter your email first' });
      return;
    }
    try {
      setBusy(true);
      await sendPasswordReset(email);
      setFormInfo('If that account exists, a reset link is on its way.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const tzLabel = COMMON_TIMEZONES.find((tz) => tz.value === timezone)?.label ?? timezone;

  return (
    <View style={styles.scene}>
      {/* The scene sits at full width from the top (never cropped sideways) and fades into the background. */}
      <View style={styles.sceneWrap} pointerEvents="none">
        <Image source={SCENE} style={{ width, height: width * 1.5 }} resizeMode="cover" />
        <LinearGradient colors={['rgba(20,14,7,0)', kitColors.background]} style={styles.fade} />
      </View>
      {/* 'padding' on both: with Android edge-to-edge, 'height' left the panel stuck up after the keyboard closed. */}
      <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl * 2, paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header">HabitScape</Text>
            <Text style={styles.tagline}>Your habits power the adventure</Text>
          </View>

          <Panel title={isSignUp ? 'Create your account' : 'Welcome back'} style={styles.panel}>
            <Field
              value={email}
              onChange={(t) => { setEmail(t); if (formError) setFormError(null); }}
              placeholder="Email"
              keyboardType="email-address"
              error={errors.email}
              editable={!isLoading}
            />
            <Field
              value={password}
              onChange={(t) => { setPassword(t); if (formError) setFormError(null); }}
              placeholder="Password"
              secure={!showPassword}
              error={errors.password}
              editable={!isLoading}
              right={
                <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" hitSlop={10}>
                  <Text style={styles.link}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              }
            />
            {isSignUp ? (
              <Pressable onPress={() => setPickTimezone(true)} disabled={isLoading} accessibilityRole="button" accessibilityLabel={`Timezone: ${tzLabel}. Change`}>
                <NineSlice frame={FRAMES.slot} padding={space.xxs} style={styles.field}>
                  <Text style={[styles.input, styles.flex, styles.tzText]} numberOfLines={1}>{tzLabel}</Text>
                  <Text style={styles.link}>Change</Text>
                </NineSlice>
              </Pressable>
            ) : (
              <Pressable onPress={forgotPassword} disabled={isLoading} accessibilityRole="button" accessibilityLabel="Forgot password? Send a reset link to the email above" style={styles.forgot} hitSlop={8}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            )}

            {formError && <Text style={[type.caption, { color: kitColors.red }]} accessibilityLiveRegion="polite">{formError}</Text>}
            {formInfo && <Text style={[type.caption, { color: kitColors.green }]} accessibilityLiveRegion="polite">{formInfo}</Text>}

            {isLoading ? (
              <View style={styles.spinner}><ActivityIndicator color={kitColors.gold} /></View>
            ) : (
              <View style={styles.buttonRow}>
                <KitButton label={isSignUp ? 'Create account' : 'Log in'} onPress={submit} />
              </View>
            )}

            <Pressable onPress={switchMode} accessibilityRole="button" style={styles.switch} hitSlop={8}>
              <Text style={type.caption}>
                {isSignUp ? 'Have an account? ' : 'New here? '}
                <Text style={styles.link}>{isSignUp ? 'Log in' : 'Sign up'}</Text>
              </Text>
            </Pressable>
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickTimezone} transparent animationType="fade" onRequestClose={() => setPickTimezone(false)}>
        <View style={styles.modalBack}>
          <Panel title="Timezone" style={styles.modalPanel}>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {COMMON_TIMEZONES.map((tz) => (
                <Pressable
                  key={tz.value}
                  onPress={() => { setTimezone(tz.value); setPickTimezone(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tz.value === timezone }}
                  style={styles.tzRow}
                >
                  <Text style={[type.body, tz.value === timezone && { color: kitColors.gold }]}>{tz.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.buttonRow}><KitButton label="Close" kind="secondary" onPress={() => setPickTimezone(false)} /></View>
          </Panel>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: kitColors.background },
  sceneWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%' },
  content: { flexGrow: 1, paddingHorizontal: space.gutter, justifyContent: 'space-between', gap: space.xl },
  titleBlock: { alignItems: 'center', gap: space.xs },
  title: {
    fontFamily: kitFonts.bold, fontSize: 44, lineHeight: 52, color: kitColors.gold,
    textShadowColor: '#1a0f06', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0,
  },
  tagline: {
    fontFamily: kitFonts.text, fontSize: 24, color: kitColors.text,
    textShadowColor: '#1a0f06', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
  },
  panel: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  fieldError: { opacity: 0.95 },
  input: { flex: 1, fontFamily: kitFonts.text, fontSize: 22, color: kitColors.text, paddingVertical: 0 },
  flex: { flex: 1 },
  link: { fontFamily: kitFonts.text, fontSize: 20, color: kitColors.gold },
  forgot: { alignSelf: 'flex-end' },
  buttonRow: { flexDirection: 'row' },
  spinner: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  switch: { alignSelf: 'center', paddingTop: space.xs },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.gutter },
  modalPanel: { maxWidth: 460, alignSelf: 'center', width: '100%' },
  tzRow: { paddingVertical: space.sm },
  tzText: { paddingHorizontal: 4 },
});
