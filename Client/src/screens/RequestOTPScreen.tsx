import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  Animated,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BASE_URL } from '../config/apiConfig';

const ORANGE = '#F97316';

const RequestOTPScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState(false);

  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message: string, success = false) => {
    setToastMessage(message);
    setToastSuccess(success);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  };

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleRequestOtp = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      showToast('Please enter your email');
      return;
    }
    if (!isValidEmail(email.trim())) {
      showToast('Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(`${BASE_URL}/users/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailOrPhone: normalizedEmail,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast('OTP sent to your email', true);
        setTimeout(() => {
          navigation.navigate('VerifyOTP', {
            email: email.trim(),
            source: 'RequestOTP',
          });
        }, 500);
      } else {
        showToast(data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      showToast(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          {/* Icon Circle */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>✉️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Request OTP</Text>
          <Text style={styles.subtitle}>
            Enter your email address to receive a one-time verification code
          </Text>

          {/* Email Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.emailInput,
                isFocused ? styles.emailInputFocused : styles.emailInputBlurred,
              ]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor="#a0a0a0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={ORANGE}
              returnKeyType="done"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Request OTP Button */}
          <TouchableOpacity
            style={[styles.requestButton, loading && styles.requestButtonLoading]}
            onPress={handleRequestOtp}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.requestButtonText}>
              {loading ? 'Sending...' : 'Request OTP'}
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {/* Toast Notification */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            toastSuccess ? styles.toastSuccess : styles.toastError,
            { opacity: toastOpacity },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  // Icon
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 30,
  },

  // Title
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b6b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 6,
  },

  // Email Field
  fieldWrapper: {
    width: '100%',
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  emailInput: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  emailInputBlurred: {
    borderColor: '#e0e0e0',
  },
  emailInputFocused: {
    borderColor: ORANGE,
  },

  // Request Button
  requestButton: {
    width: '100%',
    height: 54,
    backgroundColor: ORANGE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonLoading: {
    opacity: 0.7,
  },
  requestButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 28,
    right: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastSuccess: {
    backgroundColor: ORANGE,
  },
  toastError: {
    backgroundColor: '#e53935',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default RequestOTPScreen;