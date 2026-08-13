/**
 * Language Context — bilingual English / Hindi support.
 * Toggle is persisted in AsyncStorage under @probook_lang_v1.
 * Wrap the app in <LanguageProvider> then call useLanguage() anywhere.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'hi';

const STORAGE_KEY = '@probook_lang_v1';

// ── String tables ─────────────────────────────────────────────────────────────
const strings = {
  en: {
    // Common
    appName: 'Fix Omni',
    loading: 'Loading…',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    submit: 'Submit',
    confirm: 'Confirm',
    or: 'or',
    optional: 'Optional',
    required: '(required)',
    error: 'Error',
    success: 'Success',

    // Language toggle
    language: 'Language',
    english: 'English',
    hindi: 'हिंदी',
    switchLang: 'Switch Language',

    // Auth — common
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    forgotPassword: 'Forgot Password?',
    fullName: 'Full Name',
    mobileOrEmail: 'Mobile Number or Email ID',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    newPassword: 'New Password',
    mobileNumber: 'Mobile Number',
    emailId: 'Email ID',
    showPassword: 'Show Password',
    hidePassword: 'Hide Password',
    sendOtp: 'Send OTP',
    verifyOtp: 'Verify OTP',
    resendOtp: 'Resend OTP',
    resendIn: 'Resend in',
    seconds: 's',
    enterOtp: 'Enter 6-digit OTP',
    otpSentTo: 'OTP sent to',
    setNewPassword: 'Set New Password',
    passwordPlaceholder: 'Min. 8 characters',
    accountCreated: 'Account Created!',
    loginSuccess: 'Logged In!',
    welcomeBack: 'Welcome back',
    continueToApp: 'Continue to App',

    // Customer auth
    customerLogin: 'Customer Login',
    customerRegister: 'Create Account',
    guestContinue: 'Continue as Guest',
    alreadyHaveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    phoneUnique: 'One mobile number = one account',
    loginToBook: 'Login to confirm your booking',
    bookingAuthMsg: 'Create a free account to track your bookings, get updates, and more.',

    // Technician auth
    technicianLogin: 'Technician Login',
    technicianRegister: 'Register as Technician',
    techId: 'Technician ID',
    techIdPlaceholder: 'e.g. TECH-XXXXXX',
    yourTechId: 'Your Technician ID',
    techIdAssigned: 'Your unique Technician ID has been assigned:',
    professionType: 'Profession Type',
    saveTechId: '⚠️ Save this ID — required for every login',

    // Forgot password
    forgotPasswordTitle: 'Reset Password',
    forgotPasswordDesc: 'Enter your registered email. We\'ll send a 6-digit OTP.',
    otpVerifyTitle: 'Verify OTP',
    otpVerifyDesc: 'Enter the OTP sent to your email.',
    resetPasswordTitle: 'Create New Password',
    resetSuccess: 'Password reset successfully!',

    // Booking
    confirmBooking: 'Confirm Booking',
    bookService: 'Book Service',

    // Profile / More
    myAccount: 'My Account',
    accountSettings: 'Account Settings',
    languageSettings: 'Language Settings',
    theme: 'Theme',
    notifications: 'Notifications',
    helpline: 'Helpline',
    marketRates: 'Market Rates',
    appRating: 'Rate the App',

    // Professions
    ac_technician: 'AC Technician',
    electrician: 'Electrician',
    plumber: 'Plumber',
    carpenter: 'Carpenter',
    painter: 'Painter',
    repair: 'Repair',
  },

  hi: {
    // Common
    appName: 'Fix Omni',
    loading: 'लोड हो रहा है…',
    back: 'वापस',
    save: 'सेव करें',
    cancel: 'रद्द करें',
    close: 'बंद करें',
    submit: 'जमा करें',
    confirm: 'पुष्टि करें',
    or: 'या',
    optional: '(वैकल्पिक)',
    required: '(जरूरी)',
    error: 'त्रुटि',
    success: 'सफलता',

    // Language toggle
    language: 'भाषा',
    english: 'English',
    hindi: 'हिंदी',
    switchLang: 'भाषा बदलें',

    // Auth — common
    login: 'लॉगिन',
    register: 'रजिस्टर',
    logout: 'लॉगआउट',
    forgotPassword: 'पासवर्ड भूल गए?',
    fullName: 'पूरा नाम',
    mobileOrEmail: 'मोबाइल नंबर या Email ID',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड दोबारा डालें',
    newPassword: 'नया पासवर्ड',
    mobileNumber: 'मोबाइल नंबर',
    emailId: 'Email ID',
    showPassword: 'पासवर्ड दिखाएं',
    hidePassword: 'पासवर्ड छुपाएं',
    sendOtp: 'OTP भेजें',
    verifyOtp: 'OTP जांचें',
    resendOtp: 'OTP दोबारा भेजें',
    resendIn: 'दोबारा भेजें',
    seconds: 'सेकंड में',
    enterOtp: '6-अंक OTP डालें',
    otpSentTo: 'OTP भेजा गया',
    setNewPassword: 'नया पासवर्ड बनाएं',
    passwordPlaceholder: 'कम से कम 8 अक्षर',
    accountCreated: 'Account बन गया!',
    loginSuccess: 'लॉगिन सफल!',
    welcomeBack: 'वापसी पर स्वागत है',
    continueToApp: 'App पर जाएं',

    // Customer auth
    customerLogin: 'Customer लॉगिन',
    customerRegister: 'Account बनाएं',
    guestContinue: 'Guest के रूप में जारी रखें',
    alreadyHaveAccount: 'पहले से account है?',
    noAccount: 'Account नहीं है?',
    phoneUnique: 'एक मोबाइल = एक account',
    loginToBook: 'Booking confirm करने के लिए Login करें',
    bookingAuthMsg: 'Free account बनाएं — Booking track करें, updates पाएं।',

    // Technician auth
    technicianLogin: 'Technician लॉगिन',
    technicianRegister: 'Technician के रूप में रजिस्टर',
    techId: 'Technician ID',
    techIdPlaceholder: 'जैसे TECH-XXXXXX',
    yourTechId: 'आपका Technician ID',
    techIdAssigned: 'आपको यह unique Technician ID मिली है:',
    professionType: 'पेशा चुनें',
    saveTechId: '⚠️ यह ID संभाल कर रखें — हर login में जरूरी है',

    // Forgot password
    forgotPasswordTitle: 'पासवर्ड रीसेट करें',
    forgotPasswordDesc: 'अपना registered email डालें। हम 6-digit OTP भेजेंगे।',
    otpVerifyTitle: 'OTP जांचें',
    otpVerifyDesc: 'Email पर भेजा गया OTP डालें।',
    resetPasswordTitle: 'नया पासवर्ड बनाएं',
    resetSuccess: 'पासवर्ड सफलतापूर्वक बदल गया!',

    // Booking
    confirmBooking: 'Booking Confirm करें',
    bookService: 'Service Book करें',

    // Profile / More
    myAccount: 'मेरा Account',
    accountSettings: 'Account Settings',
    languageSettings: 'भाषा सेटिंग',
    theme: 'थीम',
    notifications: 'सूचनाएं',
    helpline: 'हेल्पलाइन',
    marketRates: 'बाजार दरें',
    appRating: 'App को Rate करें',

    // Professions
    ac_technician: 'AC Technician',
    electrician: 'Electrician',
    plumber: 'Plumber',
    carpenter: 'Carpenter',
    painter: 'Painter',
    repair: 'Repair',
  },
} as const;

export type StringKeys = keyof typeof strings.en;
export type Strings = typeof strings.en;

type LanguageCtx = {
  lang: Lang;
  t: Strings;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageCtx>({
  lang: 'en',
  t: strings.en,
  setLang: () => {},
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'hi' || v === 'en') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={{ lang, t: strings[lang] as Strings, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
