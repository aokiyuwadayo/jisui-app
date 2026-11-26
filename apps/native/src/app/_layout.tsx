import { api } from "@jisui/backend/api";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthLoading, Authenticated, ConvexReactClient, Unauthenticated } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { LoginScreen } from "@/components/LoginScreen";
import { CONVEX_URL } from "@/lib/config";
import { secureStorage } from "@/lib/storage";
import { colors, serif } from "@/lib/theme";

const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} api={api.auth} storage={secureStorage}>
      <StatusBar style="dark" />
      <AuthLoading>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
          <ActivityIndicator color={colors.roast} />
        </View>
      </AuthLoading>
      <Unauthenticated>
        <LoginScreen />
      </Unauthenticated>
      <Authenticated>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.cream },
            headerTintColor: colors.espresso,
            headerTitleStyle: { fontFamily: serif, fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add" options={{ presentation: "modal", title: "食材を追加" }} />
          <Stack.Screen name="recipe/[id]" options={{ title: "" }} />
        </Stack>
      </Authenticated>
    </ConvexAuthProvider>
  );
}
