import { Linking, Alert } from 'react-native';

export const makeDirectCall = (phoneNumber, leadName, onCallComplete) => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  
  Linking.openURL(`tel:${cleanPhone}`)
    .then(() => {
      // Trigger Post-Call Action Modal
      if (onCallComplete) {
        setTimeout(() => {
          onCallComplete(leadName, phoneNumber);
        }, 1000);
      }
    })
    .catch(() => Alert.alert("Error", "Unable to launch Phone Dialer"));
};