import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGoogleSignIn } from "@/lib/useGoogleSignIn";
import { colors, serif } from "@/lib/theme";

export function LoginScreen() {
  const { start, status } = useGoogleSignIn();
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>HOME KITCHEN</Text>
      <Text style={styles.logo}>jisui</Text>
      <Text style={styles.lead}>冷蔵庫の中身から、{"\n"}今日の一皿を。</Text>
      <Pressable
        accessibilityRole="button"
        disabled={status === "pending"}
        onPress={() => void start()}
        style={({ pressed }) => [styles.button, (pressed || status === "pending") && { opacity: 0.7 }]}
      >
        <Text style={styles.buttonText}>{status === "pending" ? "ログイン中…" : "Google でログイン"}</Text>
      </Pressable>
      {status === "error" && (
        <Text style={styles.error}>ログインできませんでした。許可されたアカウントか確認してください。</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.cream },
  eyebrow: { fontSize: 11, letterSpacing: 4, color: colors.mute },
  logo: { marginTop: 12, fontFamily: serif, fontSize: 48, fontWeight: "700", color: colors.espresso },
  lead: { marginTop: 16, textAlign: "center", fontSize: 14, lineHeight: 22, color: colors.roast },
  button: {
    marginTop: 48,
    width: "100%",
    maxWidth: 320,
    borderRadius: 999,
    backgroundColor: colors.espresso,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.cream, fontSize: 14, fontWeight: "600" },
  error: { marginTop: 16, maxWidth: 320, textAlign: "center", fontSize: 12, color: colors.alert },
});
