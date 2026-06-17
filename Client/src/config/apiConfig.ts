import { Platform } from 'react-native';
export const BASE_URL = process.env.REACT_NATIVE_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api');
