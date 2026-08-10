import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { useThemeColors } from "@/constants/theme";

export const unstable_settings = { initialRouteName: "home" };

export default function TabLayout() {
  const C = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textSecondary,
        tabBarStyle: { backgroundColor: C.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarIcon: ({ color }) => (
            <Feather name="credit-card" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => (
            <Feather name="list" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
