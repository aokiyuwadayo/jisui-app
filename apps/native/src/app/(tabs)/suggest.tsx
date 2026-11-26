import { api } from "@jisui/backend/api";
import { useQuery } from "convex/react";
import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { Empty, PageTitle, styles } from "@/components/ui";
import { colors } from "@/lib/theme";

/** レシピブックから、今の在庫と器具で作りやすい順 */
export default function SuggestScreen() {
  const suggestions = useQuery(api.suggestions.fromBook, {});
  return (
    <FlatList
      style={styles.screen}
      data={suggestions ?? []}
      keyExtractor={(r) => r._id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<PageTitle eyebrow="SUGGEST" title="今日なにつくる？" />}
      ListEmptyComponent={
        suggestions === undefined ? undefined : (
          <Empty>{"作れそうなレシピがありません。\nレシピを保存するか、Web 版の AI 提案を使ってください。"}</Empty>
        )
      }
      renderItem={({ item: r }) => (
        <Link href={{ pathname: "/recipe/[id]", params: { id: r._id } }} asChild>
          <Pressable style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={[styles.body, { fontWeight: "600", flexShrink: 1 }]}>{r.title}</Text>
              {r.cookMinutes ? <Text style={styles.small}>{r.cookMinutes}分</Text> : null}
            </View>
            {r.match.urgent.length > 0 && (
              <Text style={{ marginTop: 4, fontSize: 11, color: colors.terracotta }}>
                早めに使いたい {r.match.urgent.join("・")} を使えます
              </Text>
            )}
            <Text style={[styles.small, { marginTop: 4 }]}>
              {r.match.missing.length === 0 ? "今ある材料で作れます" : `足りないもの：${r.match.missing.join("・")}`}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
