import React, { useRef, useState, useContext } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { BASE_URL } from '../config/apiConfig';
import { AuthContext } from '../context/AuthContext';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'function') {
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      return JSON.parse(jsonPayload);
    }
    if (typeof global !== 'undefined' && (global as any).Buffer) {
      const jsonPayload = (global as any).Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }
    return null;
  } catch (e) {
    return null;
  }
}

const ORANGE = '#F97316';

const UpdatePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, otp } = route.params || {};
  const { token } = useContext(AuthContext);
  const isLoggedInMode = !email && !otp && !!token;
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [focusedField, setFocusedField] = useState<'current' | 'password' | 'confirm' | null>(null);
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

  const handleUpdatePassword = async () => {
    Keyboard.dismiss();

    if (isLoggedInMode && !currentPassword.trim()) {
      showToast('Please enter your current password');
      return;
    }
    if (!password.trim() || !confirmPassword.trim()) {
      showToast('Please fill in both fields');
      return;
    }
    if (password.length < 8) {
      showToast('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match');
      return;
    }
    if (!isLoggedInMode && (!email || !otp)) {
      showToast('Missing email or OTP to update password');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (isLoggedInMode) {
        const payload: any = parseJwt(token);
        if (!payload || !payload.id) {
          showToast('Invalid session');
          setLoading(false);
          return;
        }
        response = await fetch(`${BASE_URL}/users/change-password/${payload.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: password,
          }),
        });
      } else {
        response = await fetch(`${BASE_URL}/users/update-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailOrPhone: email,
            otp,
            newPassword: password,
          }),
        });
      }

      const data = await response.json();

      if (response.ok && data.success) {
        showToast('Password updated successfully', true);
        setCurrentPassword('');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          if (isLoggedInMode) {
             if (navigation.canGoBack()) navigation.goBack();
          } else {
             navigation.navigate('Login');
          }
        }, 1200);
      } else {
        showToast(data.message || 'Failed to update password');
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
            <Text style={styles.iconEmoji}>🔒</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{isLoggedInMode ? 'Change Password' : 'Update Password'}</Text>
          <Text style={styles.subtitle}>
            {isLoggedInMode 
              ? 'Enter your current password to set a new one'
              : 'Your new password must be different from previously used passwords'
            }
          </Text>

          {/* Current Password Field (Only in logged-in mode) */}
          {isLoggedInMode && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <View
                style={[
                  styles.inputRow,
                  focusedField === 'current'
                    ? styles.inputRowFocused
                    : styles.inputRowBlurred,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  onFocus={() => setFocusedField('current')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter current password"
                  placeholderTextColor="#a0a0a0"
                  secureTextEntry={!showCurrentPassword}
                  selectionColor={ORANGE}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Text style={styles.eyeIcon}>
                    {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Password Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <View
              style={[
                styles.inputRow,
                focusedField === 'password'
                  ? styles.inputRowFocused
                  : styles.inputRowBlurred,
              ]}
            >
              <TextInput
                style={styles.inputField}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter new password"
                placeholderTextColor="#a0a0a0"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={ORANGE}
                returnKeyType="next"
                accessibilityLabel="New password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.6}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <View
              style={[
                styles.inputRow,
                focusedField === 'confirm'
                  ? styles.inputRowFocused
                  : styles.inputRowBlurred,
              ]}
            >
              <TextInput
                style={styles.inputField}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                placeholder="Re-enter new password"
                placeholderTextColor="#a0a0a0"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={ORANGE}
                returnKeyType="done"
                accessibilityLabel="Confirm password"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                activeOpacity={0.6}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Update Password Button */}
          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonLoading]}
            onPress={handleUpdatePassword}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.updateButtonText}>
              {loading ? 'Updating...' : 'Update Password'}
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

  // Fields
  fieldWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  inputRow: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  inputRowBlurred: {
    borderColor: '#e0e0e0',
  },
  inputRowFocused: {
    borderColor: ORANGE,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    height: '100%',
  },
  eyeButton: {
    paddingLeft: 10,
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
  },

  // Update Button
  updateButton: {
    width: '100%',
    height: 54,
    backgroundColor: ORANGE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonLoading: {
    opacity: 0.7,
  },
  updateButtonText: {
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

export default UpdatePasswordScreen;