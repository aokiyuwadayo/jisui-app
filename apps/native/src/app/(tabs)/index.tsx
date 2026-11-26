import { api } from "@jisui/backend/api";
import type { Doc } from "@jisui/backend/dataModel";
import {
  adjustQuantity,
  CATEGORY_LABELS,
  expiryLabel,
  expiryStatus,
  STORAGE_LABELS,
  STORAGES,
  type Storage,
  stepFor,
  todayInTokyo,
} from "@jisui/core";
import { useMutation, useQuery } from "convex/react";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Chips, Empty, PageTitle, styles } from "@/components/ui";
import { colors } from "@/lib/theme";

type Filter = "all" | Storage | "seasoning";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  ...STORAGES.map((s) => ({ value: s, label: STORAGE_LABELS[s] })),
  { value: "seasoning", label: "調味料" },
];

function matches(item: Doc<"ingredients">, filter: Filter) {
  if (filter === "all") return item.category !== "seasoning";
  if (filter === "seasoning") return item.category === "seasoning";
  return item.storage === filter && item.category !== "seasoning";
}

const badgeColors = {
  expired: colors.alert,
  today: colors.terracotta,
  soon: colors.terracotta,
  ok: colors.sage,
  none: colors.mute,
} as const;

export default function FridgeScreen() {
  const items = useQuery(api.ingredients.list);
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayInTokyo();
  const visible = useMemo(() => (items ?? []).filter((i) => matches(i, filter)), [items, filter]);
  const urgent = (items ?? []).filter((i) => ["expired", "today", "soon"].includes(expiryStatus(i.expiresOn, today)));

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <PageTitle eyebrow="TODAY" title="冷蔵庫" />
            {urgent.length > 0 && (
              <View style={{ borderRadius: 16, backgroundColor: "#c2673f1a", padding: 14 }}>
                <Text style={{ fontSize: 11, color: colors.terracotta }}>早めに使いたい食材</Text>
                <Text style={[styles.body, { marginTop: 4, fontSize: 14 }]}>
                  {urgent.map((i) => i.name).join("・")}
                </Text>
              </View>
            )}
            <Chips options={filters} value={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={
          items === undefined ? undefined : <Empty>{"まだ何も入っていません。\n右下の「＋」から追加しましょう。"}</Empty>
        }
        renderItem={({ item }) => <IngredientRow item={item} today={today} />}
      />
      <Link href="/add" asChild>
        <Pressable
          accessibilityLabel="食材を追加"
          style={{
            position: "absolute",
            right: 20,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.terracotta,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.paper, fontSize: 26, lineHeight: 30 }}>＋</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function IngredientRow({ item, today }: { item: Doc<"ingredients">; today: string }) {
  const adjust = useMutation(api.ingredients.adjust).withOptimisticUpdate((store, { id, delta }) => {
    const list = store.getQuery(api.ingredients.list, {});
    if (!list) return;
    store.setQuery(
      api.ingredients.list,
      {},
      list.map((i) => (i._id === id ? { ...i, quantity: adjustQuantity(i.quantity, delta) } : i)),
    );
  });
  const step = stepFor(item.unit);
  const status = expiryStatus(item.expiresOn, today);

  return (
    <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.body, { fontWeight: "600", flexShrink: 1 }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 11, color: badgeColors[status] }}>{expiryLabel(item.expiresOn, today)}</Text>
        </View>
        <Text style={[styles.small, { marginTop: 4 }]}>
          {STORAGE_LABELS[item.storage]}・{CATEGORY_LABELS[item.category]}
        </Text>
      </View>
      {item.unit === "適量" ? (
        <Text style={styles.small}>適量</Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 999 }}>
          <Step label={`${item.name}を減らす`} onPress={() => void adjust({ id: item._id, delta: -step })}>
            −
          </Step>
          <Text style={{ minWidth: 56, textAlign: "center", fontSize: 14, color: colors.espresso }}>
            {item.quantity}
            <Text style={styles.small}> {item.unit}</Text>
          </Text>
          <Step label={`${item.name}を増やす`} onPress={() => void adjust({ id: item._id, delta: step })}>
            ＋
          </Step>
        </View>
      )}
    </View>
  );
}

function Step({ label, onPress, children }: { label: string; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.roast, fontSize: 16 }}>{children}</Text>
    </Pressable>
  );
}
