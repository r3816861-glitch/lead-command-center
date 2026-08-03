import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lead_command_center_leads_v1';

export const loadLeads = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Error loading leads", e);
    return [];
  }
};

export const saveLeads = async (leads) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (e) {
    console.error("Error saving leads", e);
  }
};