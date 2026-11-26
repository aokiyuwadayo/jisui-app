import { api } from "@jisui/backend/api";
import type { Id } from "@jisui/backend/dataModel";
import { matchRecipe, todayInTokyo } from "@jisui/core";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { PrimaryButton, styles } from "@/components/ui";
import { colors, serif } from "@/lib/theme";

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: Id<"recipes"> }>();
  const recipe = useQuery(api.recipes.get, { id });
  const stock = useQuery(api.ingredients.list);
  const markCooked = useMutation(api.recipes.markCooked);
  const toggleFavorite = useMutation(api.recipes.toggleFavorite);
  const [cooked, setCooked] = useState(false);

  if (!recipe) return <View style={styles.screen} />;
  const match = stock ? matchRecipe(recipe, stock, todayInTokyo()) : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: "" }} />
      <View>
        <Text style={{ fontFamily: serif, fontSize: 24, fontWeight: "700", color: colors.espresso }}>{recipe.title}</Text>
        <Text style={[styles.small, { marginTop: 6 }]}>
          {[
            recipe.cookMinutes && `${recipe.cookMinutes}分`,
            recipe.servings && `${recipe.servings}人分`,
            recipe.equipment.join("・"),
            recipe.cookedCount > 0 && `${recipe.cookedCount}回作った`,
          ]
            .filter(Boolean)
            .join("　")}
        </Text>
      </View>

      <View>
        <Text style={{ fontSize: 12, color: colors.mute, marginBottom: 8 }}>材料</Text>
        <View style={[styles.card, { paddingVertical: 4 }]}>
          {recipe.ingredients.map((i) => {
            const have = match?.have.includes(i.name);
            return (
              <View key={i.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                <View
                  accessibilityLabel={have ? "在庫あり" : "在庫なし"}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: have ? colors.sage : "transparent",
                    borderWidth: have ? 0 : 1,
                    borderColor: colors.mute,
                  }}
                />
                <Text style={[styles.body, { flex: 1, fontSize: 14 }]}>
                  {i.name}
                  {i.optional ? <Text style={styles.small}> お好みで</Text> : null}
                </Text>
                {i.amount ? <Text style={styles.small}>{i.amount}</Text> : null}
              </View>
            );
          })}
        </View>
        {match && match.missing.length > 0 && (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.terracotta }}>足りないもの：{match.missing.join("・")}</Text>
        )}
      </View>

      {recipe.steps.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 12, color: colors.mute }}>作り方</Text>
          {recipe.steps.map((step, n) => (
            <View key={`${n}-${step}`} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ fontFamily: serif, color: colors.terracotta }}>{n + 1}</Text>
              <Text style={[styles.body, { flex: 1, fontSize: 14, lineHeight: 22 }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {recipe.sourceUrl && (
        <Pressable onPress={() => void Linking.openURL(recipe.sourceUrl ?? "")}>
          <Text style={{ fontSize: 12, color: colors.roast, textDecorationLine: "underline" }}>元のページを開く</Text>
        </Pressable>
      )}

      <PrimaryButton
        label={cooked ? "記録しました" : "今日これを作った"}
        disabled={cooked}
        onPress={() => void markCooked({ id: recipe._id }).then(() => setCooked(true))}
      />
      <Pressable
        onPress={() => void toggleFavorite({ id: recipe._id })}
        style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 12, alignItems: "center" }}
      >
        <Text style={{ color: colors.roast }}>{recipe.favorite ? "★ お気に入り" : "☆ お気に入りに入れる"}</Text>
      </Pressable>
    </ScrollView>
  );
}
