import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BASE_URL } from '../config/apiConfig';
import { useFormik } from 'formik';
import { RegisterSchema } from '../validation/RegisterValidation';

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', label: 'US/CA' },
  { code: '+91', flag: '🇮🇳', label: 'IN' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+971', flag: '🇦🇪', label: 'AE' },
  { code: '+65', flag: '🇸🇬', label: 'SG' },
  { code: '+49', flag: '🇩🇪', label: 'DE' },
  { code: '+33', flag: '🇫🇷', label: 'FR' },
];

const RegisterationScreen = () => {
  const navigation = useNavigation();
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const formik = useFormik({
    initialValues: {
      fullName: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      agreed: false,
    },

    validationSchema: RegisterSchema,

    validateOnChange: true,
    validateOnBlur: true,

    context: {
      selectedCountry,
    },

    onSubmit: async (vals) => {
      setLoading(true);

      try {
        const numericMobile = vals.mobile.replace(/\D/g, '');

        const fullPhone = `${selectedCountry.code}${numericMobile}`;

        const response = await fetch(`${BASE_URL}/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: vals.email,
            password: vals.password,
            full_name: vals.fullName,
            phone: fullPhone,
            role_name: 'Customer',
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          Alert.alert('Success', data.message || 'Account created');

          navigation?.navigate('VerifyOTP' as never, {
            email: vals.email,
            phone: fullPhone,
            source: 'Register',
          });
        } else {
          
          Alert.alert(
            'Error',
            data.message || 'Registration failed'
          );
        }
      } catch (e: any) {
        Alert.alert(
          'Error',
          e.message || 'Network error'
        );
      } finally {
        setLoading(false);
      }
    },
  });
  const {
    handleChange,
    handleBlur,
    handleSubmit,
    values,
    errors,
    touched,
    setFieldValue,
  } = formik;



  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor='#F97316' />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🍽️</Text>
            </View>
            <Text style={styles.headerTitle}>Hi Foodie</Text>
            <Text style={styles.headerSubtitle}>Get started now</Text>
            <Text style={styles.headerCaption}>
              Welcome to Denim Martin Community Dashboard
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>

            {/* Full Name */}
            <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[
                styles.input,
                touched.fullName &&
                errors.fullName &&
                styles.inputError,
              ]}
              placeholder="Enter your full name"
              placeholderTextColor="#C4956A"
              value={values.fullName}
              onChangeText={handleChange('fullName')}
              onBlur={handleBlur('fullName')}
              autoCapitalize="words"
            />
            {touched.fullName && errors.fullName ? (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[
                styles.input,
                touched.email &&
                errors.email &&
                styles.inputError,
              ]}
              placeholder="Enter your email"
              placeholderTextColor="#C4956A"
              value={values.email}
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {touched.email && errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            {/* Mobile Number */}
            <Text style={styles.label}>Mobile number <Text style={styles.required}>*</Text></Text>
            <View
  style={[
    styles.mobileRow,
    touched.mobile &&
    errors.mobile &&
    styles.inputError,
  ]}
>
              <TouchableOpacity
                style={styles.countryPicker}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <Text style={styles.chevron}>▾</Text>
              </TouchableOpacity>
              <View style={styles.mobileDivider} />
              <TextInput
                style={styles.mobileInput}
                keyboardType="number-pad"
                value={values.mobile}
                onChangeText={(text) =>
                  setFieldValue(
                    'mobile',
                    text.replace(/[^0-9]/g, '')
                  )
                }
                onBlur={handleBlur('mobile')}
              />
            </View>
            {touched.mobile && errors.mobile ? (
              <Text style={styles.errorText}>{errors.mobile}</Text>
            ) : null}

            {/* Password */}
            <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
            <View
  style={[
    styles.passwordWrapper,
    touched.password &&
    errors.password &&
    styles.inputError,
  ]}
>
              <TextInput
  style={styles.passwordInput}
                placeholder="Create a password (min. 8 characters)"
                placeholderTextColor="#C4956A"
                value={values.password}
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {touched.password && errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password <Text style={styles.required}>*</Text></Text>
            <View
  style={[
    styles.passwordWrapper,
    touched.confirmPassword &&
    errors.confirmPassword &&
    styles.inputError,
  ]}
>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor="#C4956A"
                value={values.confirmPassword}
                onChangeText={handleChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {touched.confirmPassword && errors.confirmPassword ? (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            ) : null}

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setFieldValue('agreed', !values.agreed)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, values.agreed && styles.checkboxChecked]}>
                {values.agreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms &amp; Privacy</Text>
              </Text>
            </TouchableOpacity>
            {touched.agreed && errors.agreed ? (
              <Text style={styles.errorText}>{errors.agreed}</Text>
            ) : null}

            {/* Register Button */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => handleSubmit()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>
                  Register
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <Text style={styles.appleA}></Text>
                <Text style={styles.socialText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.socialCaption}>Social sign-in coming soon</Text>

            {/* Sign In Link */}
            <View style={styles.signInRow}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity>
                <Text style={styles.signInLink}>Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Modal */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCountryModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedCountry.code === item.code && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemFlag}>{item.flag}</Text>
                  <Text style={styles.modalItemLabel}>{item.label}</Text>
                  <Text style={styles.modalItemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF7F0',
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#F97316',
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 26 },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerCaption: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  form: {
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  label: {
    fontSize: 13,
    color: '#7A4010',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
  },
  required: { color: '#FF5A1F' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFCBA4',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#5C3D1E',
  },
  inputError: { borderColor: '#FF5A1F' },
  errorText: {
    fontSize: 12,
    color: '#FF5A1F',
    marginTop: 4,
    marginLeft: 2,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFCBA4',
    borderRadius: 10,
    height: 48,
    overflow: 'hidden',
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
    height: '100%',
  },
  countryFlag: { fontSize: 18 },
  countryCode: {
    fontSize: 13,
    color: '#5C3D1E',
    fontWeight: '500',
  },
  chevron: { fontSize: 11, color: '#C4956A' },
  mobileDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#FFCBA4',
  },
  mobileInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#5C3D1E',
    height: '100%',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFCBA4',
    borderRadius: 10,
    height: 48,
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#5C3D1E',
  },
  eyeBtn: { padding: 8 },
  eyeIcon: { fontSize: 16 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#F97316' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  termsText: { fontSize: 13, color: '#8C5A30' },
  termsLink: { color: '#F97316', fontWeight: '600' },
  registerButton: {
    backgroundColor: '#F97316',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#F5C4A0' },
  dividerText: { fontSize: 12, color: '#B35C1E' },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFCBA4',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleG: { fontSize: 17, fontWeight: '700', color: '#F97316' },
  appleA: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  socialText: { fontSize: 14, color: '#8C5A30', fontWeight: '500' },
  socialCaption: {
    textAlign: 'center',
    fontSize: 12,
    color: '#C4956A',
    marginTop: 10,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signInText: { fontSize: 13, color: '#8C5A30' },
  signInLink: { fontSize: 13, color: '#F97316', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF7F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5C3D1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 12,
  },
  modalItemSelected: { backgroundColor: '#FFE8D0' },
  modalItemFlag: { fontSize: 22 },
  modalItemLabel: { flex: 1, fontSize: 15, color: '#5C3D1E', fontWeight: '500' },
  modalItemCode: { fontSize: 14, color: '#B35C1E', fontWeight: '600' },
});

export default RegisterationScreen;