import { api } from "@jisui/backend/api";
import { filterRecipes, RECIPE_SORT_LABELS, RECIPE_SORTS, type RecipeSort, sortRecipes } from "@jisui/core";
import { useQuery } from "convex/react";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Chips, Empty, PageTitle, styles } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function RecipesScreen() {
  const recipes = useQuery(api.recipes.list);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RecipeSort>("recent");
  const visible = useMemo(
    () => sortRecipes(filterRecipes(recipes ?? [], { query: query.trim() || undefined }), sort),
    [recipes, query, sort],
  );

  return (
    <FlatList
      style={styles.screen}
      data={visible}
      keyExtractor={(r) => r._id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <PageTitle eyebrow="RECIPES" title="レシピブック" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="料理名・材料で探す"
            placeholderTextColor={colors.mute}
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.paper,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 16,
            }}
          />
          <Chips options={RECIPE_SORTS.map((s) => ({ value: s, label: RECIPE_SORT_LABELS[s] }))} value={sort} onChange={setSort} />
        </View>
      }
      ListEmptyComponent={
        recipes === undefined ? undefined : (
          <Empty>{recipes.length === 0 ? "まだレシピがありません。\nWeb 版や Muse から保存できます。" : "条件に合うレシピがありません。"}</Empty>
        )
      }
      renderItem={({ item: r }) => (
        <Link href={{ pathname: "/recipe/[id]", params: { id: r._id } }} asChild>
          <Pressable style={styles.card}>
            <Text style={[styles.body, { fontWeight: "600" }]}>
              {r.favorite ? <Text style={{ color: colors.terracotta }}>★ </Text> : null}
              {r.title}
            </Text>
            <Text style={[styles.small, { marginTop: 4 }]}>
              {[r.cookMinutes && `${r.cookMinutes}分`, r.cookedCount > 0 && `${r.cookedCount}回`, r.tags.map((t) => `#${t}`).join(" ")]
                .filter(Boolean)
                .join("・")}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
