import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

// Notification Handler Setup
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const scheduleLeadReminder = async (leadName, loanType, timeInMinutes = 30) => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Notification permission enable karein follow-up alerts ke liye.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📞 Cold Call Alert: ${leadName}`,
        body: `${loanType} lead follow-up time ho gaya hai. Fast-track call lagayein!`,
        sound: true,
      },
      trigger: {
        seconds: timeInMinutes * 60,
      },
    });

    Alert.alert('Reminder Set', `${timeInMinutes} mins baad ${leadName} ke liye alert set ho gaya hai!`);
  } catch (error) {
    console.error('Notification Error:', error);
  }
};