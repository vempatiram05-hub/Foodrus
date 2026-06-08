import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';

const SignupScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoEmoji}>🏎️</Text>
          <Text style={styles.logoText}>Ritchi</Text>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Create New Account</Text>
          <Text style={styles.subtitle}>
            Set up your username and password you can always change it later.
          </Text>
        </View>

        {/* Email Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Email*"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </View>

        {/* Username Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Username*"
            placeholderTextColor="#aaa"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        {/* Phone Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Phone number*"
            placeholderTextColor="#aaa"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.eyeIcon}>
            <Text style={styles.eyeText}>👁️</Text>
          </TouchableOpacity>
        </View>

        {/* Password Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Password*"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>👁️</Text>
          </TouchableOpacity>
        </View>

        {/* Signup Button */}
        <TouchableOpacity style={styles.signupBtn}>
          <Text style={styles.signupBtnText}>Signup</Text>
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginSection}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },

  logoEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },

  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B35',
  },

  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 28,
    alignItems: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },

  inputWrapper: {
    marginHorizontal: 24,
    marginVertical: 10,
    position: 'relative',
  },

  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },

  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 14,
  },

  eyeText: {
    fontSize: 18,
  },

  signupBtn: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  signupBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },

  loginText: {
    fontSize: 13,
    color: '#666',
  },

  loginLink: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
  },
});

export default SignupScreen;