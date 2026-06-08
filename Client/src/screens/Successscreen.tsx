import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

const SuccessScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn}>
        <Text style={styles.backBtnText}>‹</Text>
      </TouchableOpacity>

      {/* Success Animation Circle */}
      <View style={styles.successContainer}>
        <View style={styles.successCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        {/* Decorative Elements */}
        <View style={[styles.decorator, styles.decorator1]} />
        <View style={[styles.decorator, styles.decorator2]} />
        <View style={[styles.decorator, styles.decorator3]} />
        <View style={[styles.decorator, styles.decorator4]} />
        <View style={[styles.decorator, styles.decorator5]} />
        <View style={[styles.decorator, styles.decorator6]} />
        <View style={[styles.decorator, styles.decorator7]} />
      </View>

      {/* Title */}
      <View style={styles.content}>
        <Text style={styles.title}>Congrats! Your Order has{'\n'}been placed</Text>
        <Text style={styles.subtitle}>
          Your items has been placed and is on{'\n'}it's way to being processed
        </Text>
      </View>

      {/* Continue Shopping Button */}
      <TouchableOpacity style={styles.continueBtn}>
        <Text style={styles.continueBtnText}>CONTINUE SHOPPING</Text>
      </TouchableOpacity>

      {/* Back to Home Link */}
      <TouchableOpacity style={styles.backHomeBtn}>
        <Text style={styles.backHomeBtnText}>← Back to home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },

  backBtn: {
    paddingVertical: 14,
  },

  backBtnText: {
    fontSize: 28,
    color: '#333',
    fontWeight: '700',
  },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#A8E6C1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  checkmark: {
    fontSize: 50,
    color: '#047857',
    fontWeight: '800',
  },

  // Decorative elements
  decorator: {
    position: 'absolute',
  },

  decorator1: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
    top: '20%',
    left: '15%',
  },

  decorator2: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5B9EE0',
    bottom: '25%',
    right: '20%',
  },

  decorator3: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5B9EE0',
    top: '35%',
    right: '15%',
  },

  decorator4: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
    bottom: '30%',
    left: '20%',
  },

  decorator5: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    top: '60%',
    left: '25%',
  },

  decorator6: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5B9EE0',
    top: '50%',
    right: '22%',
  },

  decorator7: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ddd',
    bottom: '40%',
    right: '25%',
  },

  content: {
    alignItems: 'center',
    marginBottom: 40,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },

  continueBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },

  continueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  backHomeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },

  backHomeBtnText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
});

export default SuccessScreen;