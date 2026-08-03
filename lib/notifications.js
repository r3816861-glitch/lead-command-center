import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { fmtDateTime } from "./utils";

const CHANNEL_ID = "call-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function ensureNotificationsPermission() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    return final === "granted";
  } catch (e) {
    return false;
  }
}

export async function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Call Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "default",
      enableVibrate: true,
    });
  } catch (e) {}
}

// Schedules a local notification for a lead's next call. Returns the delay in
// seconds (>=1) when scheduled, or 0 when skipped (no date, invalid date, or
// non-future time). Uses an explicit `seconds` trigger — the form
// expo-notifications reliably honors on Android — instead of a bare Date,
// which could fire immediately.
export async function scheduleLeadNotification(lead) {
  if (!lead.nextCallDate) return 0;
  const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  if (!dt || isNaN(dt.getTime())) return 0;
  const now = Date.now();
  const targetTime = dt.getTime();
  const delayInSeconds = Math.floor((targetTime - now) / 1000);
  if (delayInSeconds < 1) return 0;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📞 Call Reminder: ${lead.name}`,
        body: `Follow up on ${lead.product} loan (${lead.phone})`,
        data: { leadId: lead.id },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { seconds: delayInSeconds, channelId: CHANNEL_ID },
    });
    if (__DEV__) {
      console.log(
        `[Notify] Scheduled for ${lead.name} in ${delayInSeconds}s (${dt.toLocaleString()})`
      );
    }
    return delayInSeconds;
  } catch (e) {
    return 0;
  }
}

export async function cancelAllScheduled() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled.map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );
  } catch (e) {}
}

export async function rescheduleAllNotifications(leads) {
  await cancelAllScheduled();
  for (const lead of leads) {
    if (!["converted", "lost", "disbursed"].includes(lead.status)) {
      await scheduleLeadNotification(lead);
    }
  }
}

export async function scheduleTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "This is a 5-second test — sound & banner check.",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { seconds: 5, channelId: CHANNEL_ID },
    });
  } catch (e) {}
}

// Computes the delay in seconds from now to the lead's scheduled call time.
// Returns 0 if the date is missing, invalid, or in the past.
export function computeDelayInSeconds(lead) {
  if (!lead.nextCallDate) return 0;
  const dt = fmtDateTime(lead.nextCallDate, lead.nextCallTime);
  if (!dt || isNaN(dt.getTime())) return 0;
  const delayInSeconds = Math.floor((dt.getTime() - Date.now()) / 1000);
  return delayInSeconds > 0 ? delayInSeconds : 0;
}
