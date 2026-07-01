import * as Yup from 'yup';

export const RegisterSchema = Yup.object().shape({
  fullName: Yup.string()
    .trim()
    .required('Full name is required.'),

  email: Yup.string()
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address in format example@example.example.')
    .required('Email is required.'),

  mobile: Yup.string()
    .required('Mobile number is required.')
    .test(
      'phone-format',
      'Enter a valid 10‑digit mobile number.',
      function (value) {
        const numeric = (value || '').replace(/\D/g, '');
        return /^\d{10}$/.test(numeric);
      }
    ),

  password: Yup.string()
    .min(8, 'Password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, 'Password must contain an uppercase letter, a lowercase letter, and a special character.')
    .required('Password is required.'),

  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match.')
    .required('Confirm password is required.'),

  agreed: Yup.boolean()
    .oneOf([true], 'You must agree to the Terms & Privacy.'),
});