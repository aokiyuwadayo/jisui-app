"use client";

import { api } from "@jisui/backend/api";
import { EQUIPMENT } from "@jisui/core";
import { useMutation, useQuery } from "convex/react";
import { Field } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { ToggleChips } from "@/components/ui/ToggleChips";
import { ConnectSettings } from "./ConnectSettings";

export function SettingsView() {
  const equipment = useQuery(api.settings.equipment);
  const setEquipment = useMutation(api.settings.setEquipment).withOptimisticUpdate(
    (store, { equipment: next }) => store.setQuery(api.settings.equipment, {}, next),
  );

  return (
    <section className="space-y-6 pt-2 pb-8">
      <PageTitle eyebrow="SETTINGS" title="設定" />

      <div className="rounded-2xl bg-paper p-4">
        <Field label="持っている器具" hint="提案はこの器具で作れるものに絞ります">
          {equipment === undefined ? (
            <p className="text-xs text-mute">読み込み中…</p>
          ) : (
            <ToggleChips
              label="持っている器具"
              options={EQUIPMENT}
              value={equipment ?? []}
              onChange={(next) => void setEquipment({ equipment: next })}
            />
          )}
        </Field>
        {equipment === null && (
          <p className="mt-3 text-xs text-mute">未設定のあいだは、器具を問わずに提案します。</p>
        )}
      </div>

      <ConnectSettings />
    </section>
  );
}
