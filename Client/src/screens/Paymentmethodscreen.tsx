import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

const PaymentMethodScreen: React.FC = () => {
  const [selectedPayment, setSelectedPayment] = useState('upi');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Method</Text>
        <TouchableOpacity>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.subtitle}>choose a payment option</Text>

        {/* UPI Payment */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            selectedPayment === 'upi' && styles.paymentCardSelected,
          ]}
          onPress={() => setSelectedPayment('upi')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedPayment === 'upi' && styles.radioSelected,
              ]}
            >
              {selectedPayment === 'upi' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>UPI</Text>
              <Text style={styles.paymentDesc}>Pay using any UPI app</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Credit/Debit Card */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            selectedPayment === 'card' && styles.paymentCardSelected,
          ]}
          onPress={() => setSelectedPayment('card')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedPayment === 'card' && styles.radioSelected,
              ]}
            >
              {selectedPayment === 'card' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentTitle}>💳 Credit/Debit Card</Text>
                <Text style={styles.visaBadge}>VISA</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Net Banking */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            selectedPayment === 'netbanking' && styles.paymentCardSelected,
          ]}
          onPress={() => setSelectedPayment('netbanking')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedPayment === 'netbanking' && styles.radioSelected,
              ]}
            >
              {selectedPayment === 'netbanking' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>🏦 Net Banking</Text>
              <Text style={styles.paymentDesc}>All major banks supported</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Wallets */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            selectedPayment === 'wallet' && styles.paymentCardSelected,
          ]}
          onPress={() => setSelectedPayment('wallet')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedPayment === 'wallet' && styles.radioSelected,
              ]}
            >
              {selectedPayment === 'wallet' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>💳 Wallets</Text>
              <Text style={styles.paymentDesc}>
                payment phone,Amazon pay
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Cash on Delivery */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            selectedPayment === 'cod' && styles.paymentCardSelected,
          ]}
          onPress={() => setSelectedPayment('cod')}
        >
          <View style={styles.radioContainer}>
            <View
              style={[
                styles.radio,
                selectedPayment === 'cod' && styles.radioSelected,
              ]}
            >
              {selectedPayment === 'cod' && (
                <View style={styles.radioDot} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>💵 Cash on Delivery</Text>
              <Text style={styles.paymentDesc}>
                Pay when your order is delivered
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Amount & Pay Button */}
      <View style={styles.footer}>
        <Text style={styles.amountLabel}>Amount to be paid</Text>
        <Text style={styles.amount}>₹ 1,60000</Text>
        <TouchableOpacity style={styles.payBtn}>
          <Text style={styles.payBtnText}>Pay Now</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    fontSize: 28,
    color: '#333',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  refreshIcon: {
    fontSize: 20,
  },

  subtitle: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 16,
    marginVertical: 12,
  },

  paymentCard: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 14,
  },
  paymentCardSelected: {
    borderColor: '#FFB3D9',
    backgroundColor: '#FFF5F9',
  },

  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#FF6B35',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
  },

  paymentInfo: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 12,
    color: '#666',
  },
  visaBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1434CB',
  },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  amountLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  payBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  arrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
  },
});

export default PaymentMethodScreen;