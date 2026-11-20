import 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  /** Present in Firebase's React Native build; missing from its generic wrapper declaration. */
  export function getReactNativePersistence(storage: ReactNativeStorage): Persistence;
}
