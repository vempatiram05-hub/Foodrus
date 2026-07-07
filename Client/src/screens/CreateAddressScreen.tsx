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
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config/apiConfig';

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

const ORANGE = '#F97316';

type DropdownField = 'country' | 'state' | null;

export interface DropdownOption {
  id: string;
  name: string;
}

interface DropdownModalProps {
  visible: boolean;
  title: string;
  options: DropdownOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const DropdownModal: React.FC<DropdownModalProps> = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="slide">
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => { onSelect(item.id); onClose(); }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  item.id === selected && styles.modalOptionTextSelected,
                ]}
              >
                {item.name}
              </Text>
              {item.id === selected && (
                <Text style={styles.modalOptionCheck}>✓</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </TouchableOpacity>
  </Modal>
);

const CreateAddressScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editId = route.params?.id;
  
  const { token } = useContext(AuthContext);
  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<DropdownField>(null);
  
  const [countriesList, setCountriesList] = useState<DropdownOption[]>([]);
  const [statesList, setStatesList] = useState<DropdownOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState(false);

  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchCountries();
    if (editId) {
      fetchAddressDetails(editId);
    }
  }, [editId]);

  const fetchAddressDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/addresses/getAddressById/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json();
      if (json.success && json.data) {
        const addr = json.data;
        setLabel(addr.label || '');
        setLine1(addr.line1 || '');
        setLine2(addr.line2 || '');
        setPostalCode(addr.postal_code || '');
        setCountry(addr.country_id || '');
        setState(addr.state_id || '');
        setCity(addr.city || '');
        setIsDefault(!!addr.is_default);
      }
    } catch (e) {
      console.error('Failed to fetch address details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (country) {
      fetchStates(country);
    } else {
      setStatesList([]);
    }
  }, [country]);

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${BASE_URL}/locations/country/getList`);
      const json = await response.json();
      if (json.success && json.data) {
        setCountriesList(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch countries', error);
    }
  };

  const fetchStates = async (countryId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/locations/state/by-country?country_id=${countryId}`);
      const json = await response.json();
      if (json.success && json.data) {
        setStatesList(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch states', error);
    }
  };

  const showToast = (message: string, success = false) => {
    setToastMessage(message);
    setToastSuccess(success);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!label.trim()) newErrors.label = 'Label is required';
    if (!line1.trim()) newErrors.line1 = 'Line 1 is required';
    if (!line2.trim()) newErrors.line2 = 'Line 2 is required';
    if (!postalCode.trim()) newErrors.postalCode = 'Postal code is required';
    if (!country) newErrors.country = 'Country is required';
    if (!state) newErrors.state = 'State is required';
    if (!city.trim()) newErrors.city = 'City is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!validate()) {
      showToast('Please fill in all required fields');
      return;
    }
    setLoading(true);

    try {
      const payload: any = parseJwt(token);
      if (!payload || !payload.id) {
        showToast('Authentication error. Please login again.');
        setLoading(false);
        return;
      }

      const endpoint = editId 
        ? `${BASE_URL}/addresses/updateAddress/${editId}` 
        : `${BASE_URL}/addresses/createAddress`;
      
      const method = editId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: payload.id,
          label: label.trim(),
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state_id: state,
          country_id: country,
          postal_code: postalCode.trim(),
          is_default: isDefault,
        })
      });

      const json = await response.json();
      if (json.success) {
        showToast('Address saved successfully', true);
        // Reset form
        setLabel(''); setLine1(''); setLine2(''); setPostalCode('');
        setCountry(''); setState(''); setCity(''); setIsDefault(false);
        setErrors({});
        setTimeout(() => {
          if (navigation.canGoBack()) navigation.goBack();
        }, 1200);
      } else {
        showToast(json.message || 'Failed to save address');
      }
    } catch (error) {
      console.error('Error creating address:', error);
      showToast('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCountrySelect = (value: string) => {
    setCountry(value);
    setState('');
    const err = { ...errors };
    delete err.country;
    delete err.state;
    setErrors(err);
  };

  const clearError = (key: string) => {
    if (errors[key]) {
      const err = { ...errors };
      delete err[key];
      setErrors(err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? 'Edit Address' : 'Create Address'}</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Fill in all fields to save your delivery address
          </Text>

          {/* Label */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Label <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'label' ? styles.inputFocused : styles.inputBlurred,
                errors.label ? styles.inputError : null,
              ]}
              value={label}
              onChangeText={(v) => { setLabel(v); clearError('label'); }}
              onFocus={() => setFocusedField('label')}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g. Home, Work, Other"
              placeholderTextColor="#a0a0a0"
              selectionColor={ORANGE}
              returnKeyType="next"
            />
            {errors.label ? <Text style={styles.errorText}>{errors.label}</Text> : null}
          </View>

          {/* Line 1 */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Line 1 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'line1' ? styles.inputFocused : styles.inputBlurred,
                errors.line1 ? styles.inputError : null,
              ]}
              value={line1}
              onChangeText={(v) => { setLine1(v); clearError('line1'); }}
              onFocus={() => setFocusedField('line1')}
              onBlur={() => setFocusedField(null)}
              placeholder="Street address, building no."
              placeholderTextColor="#a0a0a0"
              selectionColor={ORANGE}
              returnKeyType="next"
            />
            {errors.line1 ? <Text style={styles.errorText}>{errors.line1}</Text> : null}
          </View>

          {/* Line 2 */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Line 2 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'line2' ? styles.inputFocused : styles.inputBlurred,
                errors.line2 ? styles.inputError : null,
              ]}
              value={line2}
              onChangeText={(v) => { setLine2(v); clearError('line2'); }}
              onFocus={() => setFocusedField('line2')}
              onBlur={() => setFocusedField(null)}
              placeholder="Apartment, suite, floor, landmark"
              placeholderTextColor="#a0a0a0"
              selectionColor={ORANGE}
              returnKeyType="next"
            />
            {errors.line2 ? <Text style={styles.errorText}>{errors.line2}</Text> : null}
          </View>

          {/* Postal Code */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Postal Code <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'postal' ? styles.inputFocused : styles.inputBlurred,
                errors.postalCode ? styles.inputError : null,
              ]}
              value={postalCode}
              onChangeText={(v) => { setPostalCode(v); clearError('postalCode'); }}
              onFocus={() => setFocusedField('postal')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter postal / zip code"
              placeholderTextColor="#a0a0a0"
              keyboardType="number-pad"
              selectionColor={ORANGE}
              returnKeyType="next"
            />
            {errors.postalCode ? <Text style={styles.errorText}>{errors.postalCode}</Text> : null}
          </View>

          {/* Country Dropdown */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              Country <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownField,
                errors.country ? styles.inputError : styles.inputBlurred,
              ]}
              onPress={() => setOpenDropdown('country')}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                {country ? (countriesList.find(c => c.id === country)?.name || 'Select country') : 'Select country'}
              </Text>
              <Text style={styles.dropdownArrow}>▾</Text>
            </TouchableOpacity>
            {errors.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}
          </View>

          {/* State Dropdown */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              State <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownField,
                !country ? styles.dropdownDisabled : errors.state ? styles.inputError : styles.inputBlurred,
              ]}
              onPress={() => { if (country) setOpenDropdown('state'); }}
              activeOpacity={country ? 0.8 : 1}
            >
              <Text
                style={[
                  styles.dropdownText,
                  (!state || !country) && styles.dropdownPlaceholder,
                  !country && styles.dropdownDisabledText,
                ]}
              >
                {state ? (statesList.find(s => s.id === state)?.name || 'Select state') : (country ? 'Select state' : 'Select country first')}
              </Text>
              <Text style={[styles.dropdownArrow, !country && styles.dropdownDisabledText]}>▾</Text>
            </TouchableOpacity>
            {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
          </View>

          {/* City */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>
              City <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.inputField,
                focusedField === 'city' ? styles.inputFocused : styles.inputBlurred,
                errors.city ? styles.inputError : null,
              ]}
              value={city}
              onChangeText={(v) => { setCity(v); clearError('city'); }}
              onFocus={() => setFocusedField('city')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter city"
              placeholderTextColor="#a0a0a0"
              autoCapitalize="words"
              selectionColor={ORANGE}
              returnKeyType="done"
            />
            {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
          </View>

          {/* Is Default Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsDefault((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, isDefault && styles.checkboxChecked]}>
              {isDefault && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Set as default address</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonLoading]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? (editId ? 'Updating...' : 'Creating...') : (editId ? 'Update Address' : 'Create Address')}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>   

      {/* Country Dropdown Modal */}
      <DropdownModal
        visible={openDropdown === 'country'}
        title="Select Country"
        options={countriesList}
        selected={country}
        onSelect={handleCountrySelect}
        onClose={() => setOpenDropdown(null)}
      />

      {/* State Dropdown Modal */}
      <DropdownModal
        visible={openDropdown === 'state'}
        title="Select State"
        options={statesList}
        selected={state}
        onSelect={(v) => { setState(v); clearError('state'); }}
        onClose={() => setOpenDropdown(null)}
      />

      {/* Toast */}
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
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 52,
  },

  // Header
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconEmoji: { fontSize: 30 },
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

  // Fields
  fieldWrapper: { width: '100%', marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#000000', marginBottom: 8 },
  required: { color: ORANGE },
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
  inputBlurred: { borderColor: '#e0e0e0' },
  inputFocused: { borderColor: ORANGE },
  inputError: { borderColor: '#e53935' },
  errorText: { fontSize: 12, color: '#e53935', marginTop: 5 },

  // Dropdown
  dropdownField: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  dropdownText: { fontSize: 15, color: '#000000' },
  dropdownPlaceholder: { color: '#a0a0a0' },
  dropdownArrow: { fontSize: 14, color: '#6b6b6b' },
  dropdownDisabled: { borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  dropdownDisabledText: { color: '#c0c0c0' },

  // Checkbox
  checkboxRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  checkboxTick: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: '#000000', fontWeight: '500' },

  // Save Button
  saveButton: {
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
  saveButtonLoading: { opacity: 0.7 },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#000000' },
  modalClose: { fontSize: 16, color: '#6b6b6b', fontWeight: '500' },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalOptionText: { fontSize: 15, color: '#000000' },
  modalOptionTextSelected: { color: ORANGE, fontWeight: '600' },
  modalOptionCheck: { fontSize: 15, color: ORANGE, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 20 },

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
  toastSuccess: { backgroundColor: ORANGE },
  toastError: { backgroundColor: '#e53935' },
  toastText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
    width: '100%',
  },
  backButton: {
    padding: 8,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  backButtonPlaceholder: {
    width: 38,
  },
});

export default CreateAddressScreen;