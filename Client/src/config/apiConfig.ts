import { Platform } from 'react-native';
export const BASE_URL = process.env.REACT_NATIVE_API_URL || (Platform.OS === 'android' ? 'http://192.168.1.13:5000/api' : 'http://localhost:5000/api');
