import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

// Small secrets (a pro's session token) live in the phone's keychain; on the web (development
// only) in the browser's storage. Everything else (language, cart, the bookings made on this
// phone) is plain app storage. A storage problem never breaks a screen: reads fall back.

const web = Platform.OS === "web"

export const secret = {
  async get(key: string): Promise<string | null> {
    try {
      return web ? localStorage.getItem(key) : await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async set(key: string, value: string) {
    try {
      if (web) localStorage.setItem(key, value)
      else await SecureStore.setItemAsync(key, value)
    } catch {}
  },
  async remove(key: string) {
    try {
      if (web) localStorage.removeItem(key)
      else await SecureStore.deleteItemAsync(key)
    } catch {}
  },
}

export const prefs = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const v = await AsyncStorage.getItem(key)
      return v ? (JSON.parse(v) as T) : fallback
    } catch {
      return fallback
    }
  },
  async set(key: string, value: unknown) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
  async remove(key: string) {
    try {
      await AsyncStorage.removeItem(key)
    } catch {}
  },
}
