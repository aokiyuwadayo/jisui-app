import { api } from "@jisui/backend/api";
import {
  addDays,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type IngredientPreset,
  searchPresets,
  STORAGE_LABELS,
  STORAGES,
  type Storage,
  todayInTokyo,
  UNITS,
  validateIngredient,
} from "@jisui/core";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Chips, PrimaryButton, styles } from "@/components/ui";
import { colors } from "@/lib/theme";

const input = {
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.cream,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 10,
  fontSize: 16,
  color: colors.espresso,
} as const;

function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 12, color: colors.mute, marginBottom: 8 }}>{children}</Text>;
}

/** 食材を追加する（モーダル） */
export default function AddScreen() {
  const today = todayInTokyo();
  const create = useMutation(api.ingredients.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("vegetable");
  const [storage, setStorage] = useState<Storage>("fridge");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<string>("個");
  const [expiresOn, setExpiresOn] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const suggestions = showSuggest ? searchPresets(name) : [];

  function apply(p: IngredientPreset) {
    setName(p.name);
    setCategory(p.category);
    setStorage(p.storage);
    setUnit(p.unit);
    setQuantity(p.unit === "g" || p.unit === "ml" ? "200" : "1");
    if (p.shelfLifeDays) setExpiresOn(addDays(today, p.shelfLifeDays) ?? "");
    setShowSuggest(false);
  }

  async function save() {
    const payload = {
      name: name.trim(),
      category,
      storage,
      quantity: Number(quantity),
      unit,
      expiresOn: expiresOn || undefined,
      purchasedOn: today,
    };
    const problems = validateIngredient(payload);
    setErrors(problems);
    if (problems.length > 0) return;
    setSaving(true);
    try {
      await create(payload);
      router.back();
    } catch (e) {
      setErrors([e instanceof ConvexError ? String(e.data) : "保存できませんでした"]);
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
      <View>
        <Label>名前</Label>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setShowSuggest(true);
          }}
          placeholder="例：鶏むね肉、とりむね"
          placeholderTextColor={colors.mute}
          style={input}
          autoFocus
        />
        {suggestions.length > 0 && (
          <View style={[styles.card, { marginTop: 6, paddingVertical: 4 }]}>
            {suggestions.map((s) => (
              <Pressable key={s.name} onPress={() => apply(s)} style={{ paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.body}>{s.name}</Text>
                <Text style={styles.small}>
                  {STORAGE_LABELS[s.storage]}
                  {s.shelfLifeDays ? `・目安${s.shelfLifeDays}日` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View>
        <Label>種類</Label>
        <Chips options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} value={category} onChange={setCategory} />
      </View>

      <View>
        <Label>保存場所</Label>
        <Chips options={STORAGES.map((s) => ({ value: s, label: STORAGE_LABELS[s] }))} value={storage} onChange={setStorage} />
      </View>

      <View>
        <Label>量</Label>
        <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={input} />
        <View style={{ marginTop: 8 }}>
          <Chips options={UNITS.map((u) => ({ value: u, label: u }))} value={unit} onChange={setUnit} />
        </View>
      </View>

      <View>
        <Label>消費期限</Label>
        <Chips
          options={[
            { value: "", label: "なし" },
            ...[1, 3, 7, 14].map((d) => ({ value: addDays(today, d) ?? "", label: `${d}日後` })),
            ...(expiresOn && ![1, 3, 7, 14].some((d) => addDays(today, d) === expiresOn)
              ? [{ value: expiresOn, label: expiresOn }]
              : []),
          ]}
          value={expiresOn}
          onChange={setExpiresOn}
        />
      </View>

      {errors.map((e) => (
        <Text key={e} style={{ fontSize: 12, color: colors.alert }}>
          {e}
        </Text>
      ))}

      <PrimaryButton label="冷蔵庫に入れる" onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}
