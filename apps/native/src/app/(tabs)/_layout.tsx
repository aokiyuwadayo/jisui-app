import { useAuthActions } from "@convex-dev/auth/react";
import { Tabs } from "expo-router";
import { Pressable, Text } from "react-native";
import { colors } from "@/lib/theme";

function SignOut() {
  const { signOut } = useAuthActions();
  return (
    <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 12, color: colors.mute }}>ログアウト</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitle: "jisui",
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: colors.cream },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 24, fontWeight: "700", color: colors.espresso },
        headerRight: () => <SignOut />,
        tabBarActiveTintColor: colors.espresso,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 13, paddingBottom: 6 },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "冷蔵庫" }} />
      <Tabs.Screen name="suggest" options={{ title: "提案" }} />
      <Tabs.Screen name="recipes" options={{ title: "レシピ" }} />
    </Tabs>
  );
}
