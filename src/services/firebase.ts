import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
    'AIzaSyAFKm0_UlANuUbhVJG3tvIN8-pr6WsVwGI',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    'healthcar-e7526.firebaseapp.com',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'healthcar-e7526',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
    '1:475693557968:web:246906fb7dd1de45bdd6d5',
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
] as const;

export class FirebaseConfigurationError extends Error {
  constructor() {
    super(
      'Firebase não está configurado. Copie os dados de um app Web do Firebase para o arquivo .env.',
    );
    this.name = 'FirebaseConfigurationError';
  }
}

export function isFirebaseConfigured() {
  return requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));
}

let authInstance: Auth | undefined;
let firebaseApp: FirebaseApp | undefined;

function getFirebaseApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!isFirebaseConfigured()) {
    throw new FirebaseConfigurationError();
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirebaseFirestore() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseAuth() {
  if (authInstance) {
    return authInstance;
  }

  const app = getFirebaseApp();

  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'auth/already-initialized'
    ) {
      authInstance = getAuth(app);
    } else {
      throw error;
    }
  }

  return authInstance;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
  await updateProfile(credential.user, { displayName });
  return credential.user;
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );
  return credential.user;
}

export function observeAuthState(
  onUserChanged: (user: User | null) => void,
  onError: (error: Error) => void,
) {
  return onAuthStateChanged(getFirebaseAuth(), onUserChanged, onError);
}

export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export function signOutCurrentUser() {
  return signOut(getFirebaseAuth());
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseConfigurationError) {
    return error.message;
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;

  switch (code) {
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'A chave de API do Firebase é inválida ou está bloqueada. Confira o apiKey do app Web no Firebase Console e as restrições dessa chave no Google Cloud.';
    case 'auth/invalid-email':
      return 'Informe um endereço de e-mail válido.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar. Verifique sua conexão com a internet.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/operation-not-allowed':
      return 'Ative o login por e-mail e senha no Firebase Authentication.';
    case 'permission-denied':
      return 'A gravação foi negada pelo Firestore. Confira se as regras foram publicadas.';
    case 'failed-precondition':
      return 'O Cloud Firestore ainda não foi criado neste projeto Firebase.';
    case 'unavailable':
      return 'O serviço Firebase está temporariamente indisponível. Tente novamente.';
    default:
      return 'Não foi possível concluir a autenticação. Tente novamente.';
  }
}
