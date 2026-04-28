/**
 * AuthScreen — Cinematic OSRS Login Screen
 *
 * Visual layers (back to front):
 *   1. Sky gradient (LinearGradient)
 *   2. Stars (Animated.View twinkle — percentage positioned)
 *   3. Moon (View — dynamically scaled)
 *   4. Castle + landscape SVG with animated windows inside
 *   5. Ember particles (Animated.View — SVG-coord derived, dynamic)
 *   6. Vignette (edge LinearGradients)
 *   7. UI overlay — logo/torches/panel
 *
 * All screen-size-dependent positions are computed with useWindowDimensions()
 * inside each sub-component so they stay correct on any device or orientation.
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
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Rect,
  Polygon,
  Ellipse,
  Path,
  Defs,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { fonts } from '../constants/typography';
import { isValidEmail, validatePassword } from '../services/authService';
import { COMMON_TIMEZONES, getDefaultTimezone } from '../constants/timezones';

// ─── Design reference width ───────────────────────────────────────────────────

const DESIGN_W = 390;

// ─── Animated SVG Rect ───────────────────────────────────────────────────────

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ─── Module-level stable configs (no screen dimension dependencies) ───────────

interface StarCfg {
  x: number; y: number; size: number;
  dur: number; delay: number; lo: number; hi: number;
}

function genStars(n: number): StarCfg[] {
  const arr: StarCfg[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x: Math.random() * 100,       // % of screen width
      y: Math.random() * 68,        // % of screen height (upper portion)
      size: Math.random() < 0.2 ? 2 : 1,
      dur: (2 + Math.random() * 4) * 1000,
      delay: Math.random() * 7 * 1000,
      lo: 0.12 + Math.random() * 0.22,
      hi: 0.7 + Math.random() * 0.3,
    });
  }
  return arr;
}

// Per-ember randomness — no screen deps, stable across renders
const EMBER_RANDOMS = Array.from({ length: 18 }, (_, i) => ({
  windowIdx: Math.floor(i / 3),
  dx: (Math.random() - 0.5) * 12,
  dur: (2 + Math.random() * 2) * 1000,
  delay: Math.random() * 3 * 1000,
  jitter: Math.random() * 8 - 4,
}));

// SVG-coordinate centers of the glowing castle windows (viewBox 0 0 390 240)
const WINDOW_SVG = [
  { x: 177, y: 85,  w: 10, h: 14, fill: '#cc7700', dur: 2000, delay: 0    },
  { x: 203, y: 85,  w: 10, h: 14, fill: '#cc7700', dur: 2000, delay: 800  },
  { x: 177, y: 107, w: 10, h: 12, fill: '#bb6400', dur: 2800, delay: 300  },
  { x: 203, y: 107, w: 10, h: 12, fill: '#bb6400', dur: 2800, delay: 1100 },
  { x: 155, y: 102, w: 8,  h: 11, fill: '#cc7700', dur: 3200, delay: 500  },
  { x: 227, y: 102, w: 8,  h: 11, fill: '#cc7700', dur: 3200, delay: 1300 },
];

// Window center coordinates used for ember origins
const WINDOW_CENTERS = WINDOW_SVG.map(w => ({ x: w.x + w.w / 2, y: w.y + w.h / 2 }));

const STAR_CFGS = genStars(100);

// Shooting star base configs as fractions (computed into pixels per-render)
const SHOOT_BASE = [
  { xFrac: 0.154, yFrac: 0.08, dur: 9000,  delay: 1000  },
  { xFrac: 0.513, yFrac: 0.14, dur: 14000, delay: 5000  },
  { xFrac: 0.821, yFrac: 0.05, dur: 11000, delay: 11000 },
];

// ─── Torch Component ──────────────────────────────────────────────────────────

function Torch({ delayMs = 0 }: { delayMs?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(anim, { toValue: 0.2,  duration: 260, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.45, duration: 325, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.65, duration: 260, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.82, duration: 221, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: 234, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,    duration: 0,   useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scaleX = anim.interpolate({ inputRange: [0, 0.2, 0.45, 0.65, 0.82, 1], outputRange: [1, 0.82, 1.1, 0.88, 1.06, 1] });
  const scaleY = anim.interpolate({ inputRange: [0, 0.2, 0.45, 0.65, 0.82, 1], outputRange: [1, 1.12, 0.9, 1.06, 0.95, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 0.45, 0.65, 0.82, 1], outputRange: [1, 0.88, 1, 0.82, 0.95, 1] });

  return (
    <View style={tStyles.torch}>
      <Animated.View style={[tStyles.flame, { transform: [{ scaleX }, { scaleY }], opacity }]} />
      <Animated.View style={[tStyles.glow, { opacity }]} />
      <View style={tStyles.stem} />
      <View style={tStyles.foot} />
    </View>
  );
}

const tStyles = StyleSheet.create({
  torch: { alignItems: 'center', paddingBottom: 4 },
  flame: {
    width: 13, height: 20,
    backgroundColor: '#ff8800',
    borderTopLeftRadius: 7, borderTopRightRadius: 7,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    shadowColor: '#ffcc00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
  } as any,
  glow:  { width: 20, height: 10, backgroundColor: 'rgba(255,130,0,0.2)', borderRadius: 10, marginTop: -5 },
  stem:  { width: 7, height: 18, backgroundColor: '#4a2e12', borderRadius: 2 },
  foot:  { width: 13, height: 4, backgroundColor: '#2a1806', borderRadius: 1 },
});

// ─── Stars Layer ─────────────────────────────────────────────────────────────
// Uses percentage-based positioning — no screen dims needed.

function StarsLayer() {
  const anims = useRef(STAR_CFGS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) => {
      const cfg = STAR_CFGS[i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(anim, { toValue: 1, duration: cfg.dur / 2, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: cfg.dur / 2, useNativeDriver: true }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STAR_CFGS.map((cfg, i) => {
        const opacity = anims[i].interpolate({ inputRange: [0, 1], outputRange: [cfg.lo, cfg.hi] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${cfg.x}%` as any,
              top: `${cfg.y}%` as any,
              width: cfg.size,
              height: cfg.size,
              borderRadius: cfg.size,
              backgroundColor: '#fffde8',
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Moon ─────────────────────────────────────────────────────────────────────

function Moon() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width / DESIGN_W, 1);
  return (
    <View
      style={{
        position: 'absolute',
        top: 44 * scale,
        right: 52 * scale,
        width: 56 * scale,
        height: 56 * scale,
        borderRadius: 28 * scale,
        backgroundColor: '#fff8cc',
        shadowColor: '#ffe888',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8 * scale,
        elevation: 4,
      }}
    />
  );
}

// ─── Shooting Stars ───────────────────────────────────────────────────────────

function ShootingStarsLayer() {
  const { width, height } = useWindowDimensions();
  const anims = useRef(SHOOT_BASE.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(SHOOT_BASE[i].delay),
          Animated.timing(anim, { toValue: 1, duration: SHOOT_BASE[i].dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,                 useNativeDriver: true }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SHOOT_BASE.map((cfg, i) => {
        const opacity = anims[i].interpolate({ inputRange: [0, 0.03, 0.10, 1], outputRange: [0, 1, 0, 0] });
        const translateX = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 160] });
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 70] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: cfg.xFrac * width,
              top: cfg.yFrac * height,
              width: 80,
              height: 1,
              backgroundColor: '#fffde8',
              transform: [{ translateX }, { translateY }, { rotate: '-25deg' }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Ember Particles ─────────────────────────────────────────────────────────
// Positions derived from SVG window coordinates at render time.

function EmbersLayer() {
  const { width, height } = useWindowDimensions();
  const svgH = 240 * (width / DESIGN_W);
  const svgTop = height - svgH;
  const xScale = width / DESIGN_W;
  const yScale = svgH / 240;

  const anims = useRef(EMBER_RANDOMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) => {
      const cfg = EMBER_RANDOMS[i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(anim, { toValue: 1, duration: cfg.dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,       useNativeDriver: true }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {EMBER_RANDOMS.map((cfg, i) => {
        const win = WINDOW_CENTERS[cfg.windowIdx];
        const ox = win.x * xScale + cfg.jitter;
        const oy = svgTop + win.y * yScale;
        const opacity    = anims[i].interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] });
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
        const translateX = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, cfg.dx] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: ox,
              top: oy,
              width: 2, height: 2,
              borderRadius: 1,
              backgroundColor: '#ff9900',
              opacity,
              transform: [{ translateX }, { translateY }],
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Landscape SVG with animated windows inside ───────────────────────────────
// Window glow lives inside the SVG — no overlay positioning needed.

function LandscapeSVG() {
  const { width } = useWindowDimensions();
  const svgH = 240 * (width / DESIGN_W);

  // One Animated.Value per window
  const winAnims = useRef(WINDOW_SVG.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = winAnims.map((anim, i) => {
      const { dur, delay } = WINDOW_SVG[i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: dur / 2, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: dur / 2, useNativeDriver: false }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <Svg
      style={{ position: 'absolute', bottom: 0, left: 0 }}
      width={width}
      height={svgH}
      viewBox="0 0 390 240"
      preserveAspectRatio="none"
    >
      <Defs>
        <Filter id="soft"><FeGaussianBlur stdDeviation="1.5" /></Filter>
      </Defs>

      {/* Distant haze hills */}
      <Path d="M0,120 C70,88 160,108 230,94 C290,82 350,100 390,90 L390,240 L0,240 Z" fill="#15280e" />

      {/* Rear tower left */}
      <Rect x="150" y="88" width="20" height="62" fill="#16161c" />
      <Rect x="148" y="80" width="7"  height="10" fill="#16161c" />
      <Rect x="158" y="80" width="7"  height="10" fill="#16161c" />
      <Rect x="168" y="80" width="5"  height="10" fill="#16161c" />

      {/* Main keep */}
      <Rect x="168" y="68" width="54" height="92" fill="#18181e" />
      <Rect x="166" y="57" width="10" height="13" fill="#18181e" />
      <Rect x="180" y="57" width="10" height="13" fill="#18181e" />
      <Rect x="194" y="57" width="10" height="13" fill="#18181e" />
      <Rect x="208" y="57" width="10" height="13" fill="#18181e" />

      {/* Rear tower right */}
      <Rect x="220" y="88" width="20" height="62" fill="#16161c" />
      <Rect x="217" y="80" width="5"  height="10" fill="#16161c" />
      <Rect x="225" y="80" width="7"  height="10" fill="#16161c" />
      <Rect x="235" y="80" width="7"  height="10" fill="#16161c" />

      {/* Flag pole + pennant */}
      <Rect x="193" y="28" width="2" height="30" fill="#22223a" />
      <Polygon points="195,30 210,36 195,43" fill="#38245a" opacity="0.9" />

      {/* Gate */}
      <Rect    x="181" y="128" width="28" height="32" fill="#0e0e10" />
      <Ellipse cx="195" cy="128" rx="14" ry="9" fill="#0e0e10" />
      <Rect x="183" y="128" width="2" height="32" fill="#18181e" opacity="0.6" />
      <Rect x="189" y="128" width="2" height="32" fill="#18181e" opacity="0.6" />
      <Rect x="195" y="128" width="2" height="32" fill="#18181e" opacity="0.6" />
      <Rect x="201" y="128" width="2" height="32" fill="#18181e" opacity="0.6" />
      <Rect x="207" y="128" width="2" height="32" fill="#18181e" opacity="0.6" />
      <Rect x="183" y="134" width="26" height="2" fill="#18181e" opacity="0.6" />
      <Rect x="183" y="142" width="26" height="2" fill="#18181e" opacity="0.6" />

      {/* Animated glowing windows — driven by winAnims, no overlay needed */}
      {WINDOW_SVG.map((w, i) => (
        <AnimatedRect
          key={i}
          x={w.x} y={w.y} width={w.w} height={w.h}
          fill={w.fill}
          fillOpacity={winAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.65, 0.92] }) as any}
        />
      ))}

      {/* Window halo glows */}
      <Ellipse cx="182" cy="92"  rx="14" ry="10" fill="#ff8800" opacity="0.05" />
      <Ellipse cx="208" cy="92"  rx="14" ry="10" fill="#ff8800" opacity="0.05" />

      {/* Mid hills */}
      <Path d="M0,158 C55,136 115,152 175,141 C225,132 285,150 390,138 L390,240 L0,240 Z" fill="#1c2e14" />

      {/* Trees — left cluster */}
      <Rect x="28"  y="158" width="4" height="22" fill="#12230a" /><Ellipse cx="30"  cy="151" rx="14" ry="12" fill="#162d0c" />
      <Rect x="64"  y="153" width="4" height="24" fill="#12230a" /><Ellipse cx="66"  cy="145" rx="16" ry="13" fill="#182e0d" />
      <Rect x="98"  y="156" width="4" height="20" fill="#12230a" /><Ellipse cx="100" cy="149" rx="13" ry="11" fill="#152a0b" />
      <Rect x="128" y="158" width="3" height="18" fill="#12230a" /><Ellipse cx="130" cy="152" rx="11" ry="10" fill="#13280a" />

      {/* Trees — right cluster */}
      <Rect x="262" y="156" width="4" height="20" fill="#12230a" /><Ellipse cx="264" cy="149" rx="13" ry="11" fill="#152a0b" />
      <Rect x="294" y="153" width="4" height="24" fill="#12230a" /><Ellipse cx="296" cy="145" rx="16" ry="13" fill="#182e0d" />
      <Rect x="328" y="157" width="4" height="21" fill="#12230a" /><Ellipse cx="330" cy="150" rx="14" ry="12" fill="#162d0c" />
      <Rect x="360" y="158" width="3" height="19" fill="#12230a" /><Ellipse cx="362" cy="151" rx="11" ry="10" fill="#13280a" />

      {/* Foreground hill */}
      <Path d="M0,178 C70,163 150,176 230,169 C300,163 355,174 390,168 L390,240 L0,240 Z" fill="#233e18" />

      {/* Ground strip + mist */}
      <Rect x="0" y="220" width="390" height="20" fill="#182a0d" />
      <Path d="M0,192 C80,184 170,194 260,186 C320,181 360,192 390,187 L390,240 L0,240 Z" fill="rgba(22,40,12,0.55)" />
    </Svg>
  );
}

// ─── Main AuthScreen ──────────────────────────────────────────────────────────

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { logIn, signUp, loading, error: contextError } = useAuth();
  const { width } = useWindowDimensions();

  // Cap panel width on large screens (tablet / web)
  const panelWidth = Math.min(width * 0.88, 340);

  // Form state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [localLoading, setLocalLoading] = useState(false);
  const [btnError, setBtnError] = useState(false);

  function validateForm(): boolean {
    const e: { [k: string]: string } = {};
    if (!email.trim()) {
      e.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      e.email = 'Please enter a valid email';
    }
    if (!password) {
      e.password = 'Password is required';
    } else {
      const v = validatePassword(password);
      if (!v.isValid) e.password = v.message;
    }
    if (isSignUp) {
      if (!passwordConfirm) e.passwordConfirm = 'Please confirm your password';
      else if (password !== passwordConfirm) e.passwordConfirm = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAuth() {
    if (!email || !password) {
      setBtnError(true);
      setTimeout(() => setBtnError(false), 1800);
      return;
    }
    if (!validateForm()) return;
    try {
      setLocalLoading(true);
      if (isSignUp) {
        await signUp(email, password, timezone);
      } else {
        await logIn(email, password);
      }
      onAuthSuccess?.();
    } catch {
      // contextError surfaced below
    } finally {
      setLocalLoading(false);
    }
  }

  const isLoading = loading || localLoading;

  return (
    <View style={s.scene}>
      {/* 1 ─ Sky gradient */}
      <LinearGradient
        colors={['#070520', '#0c0a28', '#10101e', '#121618', '#101f10']}
        locations={[0, 0.2, 0.45, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 ─ Stars */}
      <StarsLayer />

      {/* 3 ─ Moon */}
      <Moon />

      {/* 4 ─ Castle + landscape (windows animated inside SVG) */}
      <LandscapeSVG />

      {/* 5 ─ Embers */}
      <EmbersLayer />

      {/* 6 ─ Shooting stars */}
      <ShootingStarsLayer />

      {/* 7 ─ Vignette — use rgba(0,0,0,0) not 'transparent'; mobile browsers resolve
           'transparent' as rgba(0,0,0,0) anyway but some blend through black in between */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={s.vigTop} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={s.vigBottom} />
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.vigLeft} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.vigRight} />
      </View>

      {/* 8 ─ UI overlay */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={StyleSheet.absoluteFill}
      >
        <ScrollView
          contentContainerStyle={s.overlay}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo row */}
          <View style={s.logoRow}>
            <Torch />
            <Text style={s.title}>HabitScape</Text>
            <Torch delayMs={350} />
          </View>

          <Text style={s.tagline}>Your grind starts here.</Text>

          {/* Login / Sign-up panel */}
          <View style={[s.panel, { width: panelWidth }]}>
            <View style={s.panelRule} />
            <View style={s.panelDivider} />

            <View style={s.field}>
              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="Enter your email"
                placeholderTextColor="#4a3c18"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {errors.email ? <Text style={s.fieldError}>{errors.email}</Text> : null}
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="Enter your password"
                placeholderTextColor="#4a3c18"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {errors.password ? <Text style={s.fieldError}>{errors.password}</Text> : null}
            </View>

            {isSignUp && (
              <>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Confirm Password</Text>
                  <TextInput
                    style={[s.input, errors.passwordConfirm ? s.inputError : null]}
                    placeholder="Confirm your password"
                    placeholderTextColor="#4a3c18"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  {errors.passwordConfirm ? <Text style={s.fieldError}>{errors.passwordConfirm}</Text> : null}
                </View>

                <View style={s.field}>
                  <Text style={s.fieldLabel}>Timezone</Text>
                  <TouchableOpacity
                    style={s.input}
                    onPress={() => setTimezonePickerVisible(true)}
                    disabled={isLoading}
                  >
                    <Text style={s.inputValueText}>
                      {COMMON_TIMEZONES.find(tz => tz.value === timezone)?.label ?? timezone}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {contextError ? <Text style={s.contextError}>{contextError}</Text> : null}

            <TouchableOpacity
              style={[s.btnPrimary, btnError && s.btnError, isLoading && s.btnDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#1c1204" />
              ) : (
                <Text style={[s.btnText, btnError && s.btnErrorText]}>
                  {btnError
                    ? '⚠ FILL ALL FIELDS'
                    : isSignUp ? 'CREATE ACCOUNT' : 'LOG IN'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={s.toggleText}>
              {isSignUp ? 'Have an account? ' : "Don't have an account? "}
              <Text
                style={s.toggleLink}
                onPress={() => { setIsSignUp(!isSignUp); setErrors({}); setBtnError(false); }}
              >
                {isSignUp ? 'Log In' : 'Sign Up'}
              </Text>
            </Text>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Phase 1 MVP</Text>
            <Text style={s.footerText}>© 2026 HabitScape</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Timezone picker modal */}
      <Modal
        visible={timezonePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Timezone</Text>
              <TouchableOpacity onPress={() => setTimezonePickerVisible(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {COMMON_TIMEZONES.map(tz => (
                <TouchableOpacity
                  key={tz.value}
                  style={[s.tzOption, timezone === tz.value && s.tzOptionActive]}
                  onPress={() => { setTimezone(tz.value); setTimezonePickerVisible(false); }}
                >
                  <Text style={[s.tzLabel, timezone === tz.value && s.tzLabelActive]}>
                    {tz.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scene: { flex: 1, backgroundColor: '#070520' },

  // Vignette edges
  vigTop:    { position: 'absolute', top: 0,    left: 0, right: 0,  height: '40%' },
  vigBottom: { position: 'absolute', bottom: 0, left: 0, right: 0,  height: '50%' },
  vigLeft:   { position: 'absolute', top: 0,    left: 0, bottom: 0, width: '28%'  },
  vigRight:  { position: 'absolute', top: 0,    right: 0,bottom: 0, width: '28%'  },

  // Overlay layout
  overlay: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 24,
  },

  // Logo row
  logoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 5 },
  title: {
    fontFamily: fonts.heading,
    fontSize: 21,
    color: '#c8a857',
    lineHeight: 24,
    textShadowColor: 'rgba(200,168,87,0.65)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 24,
  },
  tagline: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontStyle: 'italic',
    color: '#8a7040',
    marginBottom: 24,
    letterSpacing: 0.5,
  },

  // Panel — width applied dynamically
  panel: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#2e2008',
    borderWidth: 2,
    borderTopColor: '#6b5820',
    borderLeftColor: '#6b5820',
    borderBottomColor: '#0a0700',
    borderRightColor: '#0a0700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  panelRule: {
    position: 'absolute',
    top: 0, left: 14, right: 14,
    height: 2,
    backgroundColor: 'rgba(200,168,87,0.4)',
  },
  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(107,88,32,0.33)',
    marginBottom: 16,
  },

  // Fields
  field: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: fonts.heading,
    fontSize: 9,
    color: '#c8a857',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 11,
    backgroundColor: '#1a1104',
    borderWidth: 2,
    borderTopColor: '#0a0700',
    borderLeftColor: '#0a0700',
    borderBottomColor: '#6b5820',
    borderRightColor: '#6b5820',
    color: '#d4b86a',
    fontFamily: fonts.display,
    fontSize: 22,
    justifyContent: 'center',
  },
  inputError: {
    borderTopColor: '#ff8888',
    borderLeftColor: '#ff8888',
  },
  inputValueText: {
    color: '#d4b86a',
    fontFamily: fonts.display,
    fontSize: 22,
  },
  fieldError: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#ff8888',
    marginTop: 3,
  },
  contextError: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: '#ff8888',
    marginBottom: 10,
    textAlign: 'center',
  },

  // Button
  btnPrimary: {
    width: '100%',
    paddingVertical: 12,
    marginTop: 2,
    marginBottom: 14,
    backgroundColor: '#c8a857',
    borderWidth: 2,
    borderTopColor: '#ffee66',
    borderLeftColor: '#ffee66',
    borderBottomColor: '#3a2c08',
    borderRightColor: '#3a2c08',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  btnError: {
    backgroundColor: '#8a2020',
    borderTopColor: '#ff8888',
    borderLeftColor: '#ff8888',
    borderBottomColor: '#3a0808',
    borderRightColor: '#3a0808',
  },
  btnDisabled: { opacity: 0.75 },
  btnText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: '#1c1204',
    letterSpacing: 0.7,
  },
  btnErrorText: { color: '#ffffff' },

  // Toggle
  toggleText: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: '#8a7040',
    textAlign: 'center',
  },
  toggleLink: { color: '#c8a857' },

  // Footer
  footer: { marginTop: 'auto' as any, paddingTop: 20, alignItems: 'center' },
  footerText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: '#2e2410',
    lineHeight: 14,
  },

  // Timezone modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#2e2008',
    maxHeight: '70%',
    borderWidth: 2,
    borderTopColor: '#6b5820',
    borderLeftColor: '#6b5820',
    borderBottomColor: '#0a0700',
    borderRightColor: '#0a0700',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1a1104',
    borderBottomWidth: 1,
    borderBottomColor: '#6b5820',
  },
  modalTitle: { fontFamily: fonts.heading, fontSize: 10, color: '#c8a857' },
  modalClose: { fontFamily: fonts.display, fontSize: 22, color: '#8a7040', paddingHorizontal: 4 },
  tzOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0a0700',
  },
  tzOptionActive: { backgroundColor: '#1a1104', borderLeftWidth: 3, borderLeftColor: '#c8a857' },
  tzLabel:       { fontFamily: fonts.display, fontSize: 18, color: '#d4b86a' },
  tzLabelActive: { color: '#c8a857' },
});
