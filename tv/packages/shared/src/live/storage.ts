import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './controller';

/** Native: the household code survives restarts in AsyncStorage. */
export const storage: KeyValueStorage = {
  get: key => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: key => AsyncStorage.removeItem(key),
};
