import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = '@lead_command_center_leads_v1';

export const loadLeads = async () => {
  try {
    // Try fetching from Supabase Cloud first
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.log("Offline mode: Reading from AsyncStorage");
  }

  // Fallback to Local Storage
  const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
  return jsonValue != null ? JSON.parse(jsonValue) : [];
};

export const saveLeads = async (leads) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    // Push updates to Supabase
    await supabase.from('leads').upsert(leads);
  } catch (e) {
    console.error("Failed to sync leads to cloud", e);
  }
};