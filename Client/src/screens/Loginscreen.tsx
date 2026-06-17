import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar,
  Alert,
  Image,
} from 'react-native';
import { BASE_URL } from '../config/apiConfig';

// ─── THEME ───────────────────────────────────────
const ORANGE = '#F97316';
const BLACK = '#1a1a1a';
const GREY = '#6b7280';
const BORDER = '#e5e7eb';
const WHITE = '#FFFFFF';

// ─── LOGO ────────────────────────────────────────
const Logo = () => (
  <View style={s.logoWrapper}>
    <Image
      source={require('../assets/images/logo/image_cropped.png')}
      style={s.logo}
      resizeMode="contain"
    />
  </View>
);

// ─── GOOGLE ICON ─────────────────────────────────
const GoogleIcon = () => (
  <View style={s.googleIcon}>
    <Text style={s.googleIconText}>G</Text>
  </View>
);

// ─── LOGIN SCREEN ────────────────────────────────
export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter phone number and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailOrPhone: phone,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Success', data.message || 'Logged in successfully');
        navigation.replace('MainTabs');
      } else {
        Alert.alert('Error', data.message || 'Login failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── LOGO ── */}
          <Logo />

          {/* ── TITLE ── */}
          <Text style={s.title}>Welcome Back</Text>
          <Text style={s.subtitle}>
            Login in to your account using email{'\n'}or social  networks
          </Text>

          {/* ── APPLE BUTTON ── */}
          <TouchableOpacity
            style={s.socialBtn}
            onPress={() => Alert.alert('Apple Login', 'Coming soon!')}
            activeOpacity={0.8}
          >
            <Text style={s.appleIcon}></Text>
            <Text style={s.socialBtnText}>Login with Apple</Text>
          </TouchableOpacity>

          {/* ── GOOGLE BUTTON ── */}
          <TouchableOpacity
            style={s.socialBtn}
            onPress={() => Alert.alert('Google Login', 'Coming soon!')}
            activeOpacity={0.8}
          >
            <GoogleIcon />
            <Text style={s.socialBtnText}>Login with Google</Text>
          </TouchableOpacity>

          {/* ── DIVIDER ── */}
          <Text style={s.dividerText}>or continue with social account</Text>

          {/* ── PHONE INPUT ── */}
          <View style={s.inputWrapper}>
            <TextInput
              style={s.input}
              placeholder="Phone number*"
              placeholderTextColor={GREY}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.eyeBtn}>
              <Text style={s.eyeIcon}>👁</Text>
            </TouchableOpacity>
          </View>

          {/* ── PASSWORD INPUT ── */}
          <View style={s.inputWrapper}>
            <TextInput
              style={s.input}
              placeholder="Password*"
              placeholderTextColor={GREY}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── FORGOT PASSWORD ── */}
          <View>
          <TouchableOpacity
            style={s.forgotBtn}
            onPress={() => navigation?.navigate('RequestOTP')}
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
          </View>

          {/* ── LOGIN BUTTON ── */}
          <TouchableOpacity
            style={[s.loginBtn, loading && s.loginBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.9}
            disabled={loading}
          >
            <Text style={s.loginBtnText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* ── REGISTER LINK ── */}
          <View style={s.registerRow}>
            <Text style={s.registerText}>Didn't have an account?  </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Register')}>
              <Text style={s.registerLink}>REGISTER</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Logo
  logoWrapper: { alignItems: 'center'},
  logo: { width: 200, height: 120 },
  // Title
  title: {
    fontSize: 26, fontWeight: '800',
    color: BLACK, textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: GREY,
    textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },

  // Social buttons
  socialBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', width: '100%',
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    backgroundColor: WHITE, marginBottom: 12, gap: 10,
  },
  appleIcon: { fontSize: 20, color: BLACK },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: BLACK },

  // Google icon
  googleIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { color: WHITE, fontSize: 13, fontWeight: '900' },

  // Divider
  dividerText: {
    fontSize: 13, color: GREY,
    textAlign: 'center', marginBottom: 20, marginTop: 4,
  },

  // Inputs
  inputWrapper: { position: 'relative', width: '100%', marginBottom: 14 },
  input: {
    width: '100%', borderWidth: 1.5,
    borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: BLACK,
    backgroundColor: WHITE, paddingRight: 48,
  },
  eyeBtn: { position: 'absolute', right: 14, top: 12, padding: 4 },
  eyeIcon: { fontSize: 18 },

  // Forgot
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -4 },
  forgotText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  // Login button
  loginBtn: {
    width: '100%', backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 28,
    elevation: 3, shadowColor: ORANGE,
    shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: WHITE, fontSize: 17, fontWeight: '700' },

  // Register
  registerRow: { flexDirection: 'row', alignItems: 'center' },
  registerText: { fontSize: 14, color: GREY },
  registerLink: { fontSize: 14, color: ORANGE, fontWeight: '800', letterSpacing: 0.5 },
});