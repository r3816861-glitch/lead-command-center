import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lead_command_center_leads_v1';

// Default initial leads if storage is empty
const INITIAL_LEADS = [
  { id: '1', name: 'Ramesh Sharma', type: 'LAP BT', status: 'Follow-up', phone: '9876543210', amount: '₹45 Lakhs', notes: 'Rate sensitive, zero fee demand' },
  { id: '2', name: 'Vikram Mehta', type: 'Home Loan', status: 'Fresh Lead', phone: '9811223344', amount: '₹80 Lakhs', notes: 'Comparing with HDFC' },
  { id: '3', name: 'Anil Gupta', type: 'MSME Loan', status: 'Doc Pickup', phone: '9900112233', amount: '₹25 Lakhs', notes: 'GST return pending' },
];

export const loadLeads = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue != null) {
      return JSON.parse(jsonValue);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LEADS));
    return INITIAL_LEADS;
  } catch (e) {
    console.error("Failed to load leads from local storage", e);
    return INITIAL_LEADS;
  }
};

export const saveLeads = async (leads) => {
  try {
    const jsonValue = JSON.stringify(leads);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save leads to local storage", e);
  }
};