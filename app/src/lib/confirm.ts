// Confirm / info dialogs that also work on web (react-native-web's Alert.alert is a no-op).
import { Alert, Platform } from "react-native";

export function confirm(title: string, message: string, okText: string, onOk: () => void, destructive = false) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: okText, style: destructive ? "destructive" : "default", onPress: onOk },
  ]);
}

export function info(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
