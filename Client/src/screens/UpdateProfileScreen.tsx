import React, { useRef, useState, useContext, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config/apiConfig';

const ORANGE = '#F97316';

// Decode a JWT payload
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

const UpdateProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { token, setToken } = useContext(AuthContext);
  const [userId, setUserId] = useState<string | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<any>(null);

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

  useEffect(() => {
    if (token) {
      const payload: any = parseJwt(token);
      if (payload) {
        setUserId(payload.id);
        setFullName(payload.full_name || payload.fullName || '');
        setEmail(payload.email || '');
        setPhone(payload.phone || '');
        let userImages: any[] = [];
        if (Array.isArray(payload.images)) {
          userImages = payload.images;
        } else if (typeof payload.images === 'string') {
          try {
            userImages = JSON.parse(payload.images);
          } catch (e) {
            userImages = [];
          }
        }

        if (userImages.length > 0 && userImages[0]) {
          const img = userImages[0];
          if (img.startsWith('/')) {
            setPhotoUri(`${BASE_URL.replace('/api', '')}${img}`);
          } else {
            setPhotoUri(img);
          }
        }
      }
    }
  }, [token]);

  const handlePickPhoto = async () => {
    Keyboard.dismiss();
    try {
      const image = await ImagePicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        mediaType: 'photo',
      });

      setPhotoUri(image.path);
      setPhotoFile({
        uri: image.path,
        type: image.mime,
        name: image.path.split('/').pop() || 'profile.jpg',
      });
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        showToast(error.message);
      }
    }
  };

  const handleUpdate = async () => {
    Keyboard.dismiss();

    if (!fullName.trim()) {
      showToast('Please enter your full name');
      return;
    }

    if (!userId) {
      showToast('User information is missing');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());

      if (photoFile && photoFile.uri) {
        formData.append('images', {
          uri: Platform.OS === 'ios' ? photoFile.uri.replace('file://', '') : photoFile.uri,
          type: photoFile.type || 'image/jpeg',
          name: photoFile.fileName || 'profile.jpg',
        } as any);
      }

      const response = await fetch(`${BASE_URL}/users/profile/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      console.log("UPDATE PROFILE RESPONSE DATA:", data);

      if (response.ok && data.success) {
        showToast('Profile updated successfully', true);
        setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 2000);
        if (data.token) {
          console.log("SETTING NEW TOKEN:", data.token.substring(0, 20) + "...");
          setToken(data.token);
        } else {
          console.log("WARNING: No token returned from backend API!");
        }
      } else {
        showToast(data.message || 'Update failed');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error');
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
              style={[styles.inputField, styles.inputFieldReadOnly]}
              value={email}
              editable={false}
              placeholder="you@example.com"
              placeholderTextColor="#a0a0a0"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Phone Number Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={[styles.inputField, styles.inputFieldReadOnly]}
              value={phone}
              editable={false}
              placeholder="Enter your phone number"
              placeholderTextColor="#a0a0a0"
              accessibilityLabel="Phone number"
            />
          </View>

          {/* Update Button & Inline Toast */}
          <View style={{ width: '100%', marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.updateButtonLoading, { marginTop: 0 }]}
              onPress={handleUpdate}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.updateButtonText}>
                {loading ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>

            {toastVisible && (
              <Animated.View
                style={[
                  styles.updateButton,
                  toastSuccess ? styles.toastSuccess : styles.toastError,
                  { position: 'absolute', top: 0, left: 0, right: 0, opacity: toastOpacity, marginTop: 0 },
                ]}
              >
                <Text style={styles.toastText}>{toastMessage}</Text>
              </Animated.View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

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
  inputFieldReadOnly: {
    backgroundColor: '#f5f5f5',
    color: '#6b6b6b',
    borderColor: '#e0e0e0',
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

  toastSuccess: {
    backgroundColor: ORANGE,
  },
  toastError: {
    backgroundColor: '#e53935',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default UpdateProfileScreen;