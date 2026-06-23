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
  ScrollView,
  Image,
} from 'react-native';

const ORANGE = '#F97316';

const UpdateProfileScreen = () => {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [focusedField, setFocusedField] = useState<
    'name' | 'email' | 'phone' | null
  >(null);
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

  // Hook this up to expo-image-picker or react-native-image-picker.
  // Left as a placeholder so this file has no extra dependencies.
  const handlePickPhoto = () => {
    showToast('Connect an image picker library here', true);
    // Example with expo-image-picker:
    // const result = await ImagePicker.launchImageLibraryAsync({
    //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //   allowsEditing: true,
    //   aspect: [1, 1],
    //   quality: 0.8,
    // });
    // if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleUpdate = () => {
    Keyboard.dismiss();

    if (!fullName.trim()) {
      showToast('Please enter your full name');
      return;
    }
    if (!email.trim() || !isValidEmail(email.trim())) {
      showToast('Please enter a valid email');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      showToast('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    // Simulate an update profile API call
    setTimeout(() => {
      setLoading(false);
      showToast('Profile updated successfully', true);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>Update Profile</Text>
          <Text style={styles.subtitle}>
            Keep your personal information up to date
          </Text>

          {/* Photo Upload */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoCircle}
              onPress={handlePickPhoto}
              activeOpacity={0.8}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <Text style={styles.photoEmoji}>👤</Text>
              )}
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeIcon}>＋</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.6}>
              <Text style={styles.photoLabel}>Upload Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Full Name Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'name'
                  ? styles.inputFieldFocused
                  : styles.inputFieldBlurred,
              ]}
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your full name"
              placeholderTextColor="#a0a0a0"
              autoCapitalize="words"
              selectionColor={ORANGE}
              returnKeyType="next"
              accessibilityLabel="Full name"
            />
          </View>

          {/* Email Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'email'
                  ? styles.inputFieldFocused
                  : styles.inputFieldBlurred,
              ]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              placeholderTextColor="#a0a0a0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={ORANGE}
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Phone Number Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'phone'
                  ? styles.inputFieldFocused
                  : styles.inputFieldBlurred,
              ]}
              value={phone}
              onChangeText={setPhone}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your phone number"
              placeholderTextColor="#a0a0a0"
              keyboardType="phone-pad"
              selectionColor={ORANGE}
              returnKeyType="done"
              accessibilityLabel="Phone number"
            />
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonLoading]}
            onPress={handleUpdate}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.updateButtonText}>
              {loading ? 'Updating...' : 'Update'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
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
    marginBottom: 32,
    paddingHorizontal: 6,
  },

  // Photo Upload
  photoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  photoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FBD3B0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  photoEmoji: {
    fontSize: 38,
  },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  photoBadgeIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
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
  inputField: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  inputFieldBlurred: {
    borderColor: '#e0e0e0',
  },
  inputFieldFocused: {
    borderColor: ORANGE,
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

export default UpdateProfileScreen;