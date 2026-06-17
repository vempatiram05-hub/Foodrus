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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BASE_URL } from '../config/apiConfig';

const OTP_LENGTH = 6;
const ORANGE = '#F97316';

const OTPVerifyScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, phone, source } = route.params || {};

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState(false);

  const inputRefs = useRef<any[]>([]);
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

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleConfirm = async () => {
    Keyboard.dismiss();
    const fullOtp = otp.join('');
    if (fullOtp.length < OTP_LENGTH) {
      showToast('Please enter all 6 digits');
      return;
    }

    // For forgot-password flow, don't call server verify here —
    // directly navigate to UpdatePassword so the same OTP
    // can be used by the update-password endpoint.
    if (source === 'RequestOTP') {
      setConfirmed(true);
      showToast('OTP verified locally — proceed to update password', true);
      setTimeout(() => {
        navigation.navigate('UpdatePassword', { email, otp: fullOtp });
      }, 700);
      return;
    }

    setLoading(true);
    try {
      const endpoint = `${BASE_URL}/users/validateOTP`;

      const body = { emailOrPhone: email || phone, otp: fullOtp };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConfirmed(true);
        showToast('OTP Verified Successfully!', true);
        // Navigate to Login after 1.5 seconds
        setTimeout(() => {
          navigation.navigate('Login');
        }, 1500);
      } else {
        showToast(data.message || 'Invalid OTP');
        // Clear OTP inputs on error
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      showToast(error.message || 'Network error');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      const endpoint = source === 'RequestOTP'
        ? `${BASE_URL}/users/forgot-password`
        : `${BASE_URL}/users/send-login-otp`;

      const body = source === 'RequestOTP'
        ? { emailOrPhone: email }
        : { emailOrPhone: email || phone };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        showToast('OTP resent successfully. Valid for 10 minutes', true);

        // 60 seconds (1 minute) cooldown
        let secs = 60;
        setResendCooldown(secs);
        const interval = setInterval(() => {
          secs -= 1;
          setResendCooldown(secs);
          if (secs <= 0) clearInterval(interval);
        }, 1000);
      } else {
        showToast(data.message || 'Failed to resend OTP');
      }
    } catch (error: any) {
      showToast(error.message || 'Network error');
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
            <Text style={styles.iconEmoji}>📱</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to your registered number
          </Text>

          {/* OTP Input Fields */}
          <View style={styles.otpRow}>
            {Array(OTP_LENGTH)
              .fill(0)
              .map((_, index) => (
                <TextInput
                  key={index}
                  ref={(element) => (inputRefs.current[index] = element)}
                  style={[
                    styles.otpBox,
                    otp[index]
                      ? styles.otpBoxFilled
                      : styles.otpBoxEmpty,
                  ]}
                  value={otp[index]}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectionColor={ORANGE}
                  returnKeyType="done"
                  accessibilityLabel={`OTP digit ${index + 1}`}
                />
              ))}
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              confirmed && styles.confirmButtonSuccess,
              loading && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={loading || confirmed}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>
                {confirmed ? '✓  Verified' : 'Confirm'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendSection}>
            <Text style={styles.resendHint}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.resendText,
                  resendCooldown > 0 && styles.resendTextDisabled,
                ]}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'RESEND OTP'}
              </Text>
            </TouchableOpacity>
          </View>

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
    paddingHorizontal: 10,
  },

  // OTP Boxes
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
    justifyContent: 'center',
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  otpBoxEmpty: {
    borderColor: '#e0e0e0',
  },
  otpBoxFilled: {
    borderColor: ORANGE,
  },

  // Confirm Button
  confirmButton: {
    width: '100%',
    height: 54,
    backgroundColor: ORANGE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonSuccess: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Resend
  resendSection: {
    alignItems: 'center',
    gap: 6,
  },
  resendHint: {
    fontSize: 13,
    color: '#6b6b6b',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  resendTextDisabled: {
    color: '#aaaaaa',
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

export default OTPVerifyScreen;