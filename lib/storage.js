import AsyncStorage from "@react-native-async-storage/async-storage";

const LEADS_KEY = "leadcc:leads-v3";
const SETTINGS_KEY = "leadcc:settings-v3";
const THEME_KEY = "leadcc:theme-v3";

export async function loadLeads() {
  try {
    const raw = await AsyncStorage.getItem(LEADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveLeads(leads, attempt = 1) {
  try {
    await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    return true;
  } catch (e) {
    if (attempt < 3) {
      await new Promise((res) => setTimeout(res, attempt * 400));
      return saveLeads(leads, attempt + 1);
    }
    return false;
  }
}

export async function loadSettings(defaults) {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return defaults;
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadTheme() {
  try {
    return (await AsyncStorage.getItem(THEME_KEY)) || "dark";
  } catch (e) {
    return "dark";
  }
}

export async function saveTheme(theme) {
  try {
    await AsyncStorage.setItem(THEME_KEY, theme);
    return true;
  } catch (e) {
    return false;
  }
}
