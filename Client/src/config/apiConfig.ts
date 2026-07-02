import { Platform } from 'react-native';
export const BASE_URL = process.env.REACT_NATIVE_API_URL || (Platform.OS === 'android' ? 'http://192.168.1.13:5000/api' : 'http://localhost:5000/api');
export const GOOGLE_WEB_CLIENT_ID = '638758354687-84dsag84j8qtqkf5entjm1fi1l70cdae.apps.googleusercontent.com'; 
