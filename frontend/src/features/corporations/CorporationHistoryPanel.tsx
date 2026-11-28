"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import { formatCorporationOptionLabel } from "./formatCorporationLabel";
import type {
  Corporation,
  CorporationChangeKind,
  CorporationHistoryRecord,
  CorporationStatus,
} from "./schemas";

function changeKindLabel(kind: CorporationChangeKind): string {
  switch (kind) {
    case "registration":
      return "登録";
    case "profile":
      return "基本情報変更";
    case "dissolution":
      return "解散";
    case "merger":
      return "吸収合併";
    case "correction":
      return "履歴訂正";
    case "legacy":
      return "移行データ";
  }
}

function statusLabel(status: CorporationStatus): string {
  switch (status) {
    case "active":
      return "存続";
    case "dissolved":
      return "解散";
    case "merged_out":
      return "吸収合併（消滅）";
  }
}

const STATUS_TRANSITION_OPTIONS: readonly SelectOption[] = [
  { value: "dissolved", label: "解散" },
  { value: "merged_out", label: "吸収合併（消滅）" },
];

export interface CorporationHistoryPanelProps {
  section?: "all" | "history" | "status";
  corporation: Corporation;
  activeCorporations: readonly Corporation[];
  historyRecords: readonly CorporationHistoryRecord[];
  isLoadingHistory: boolean;
  historyErrorMessage: string | null;
  snapshotParams: { as_of?: string; recorded_as_of?: string } | null;
  onLookupSnapshot: (params: { as_of?: string; recorded_as_of?: string } | null) => void;
  snapshotCorporation: Corporation | null;
  isLoadingSnapshot: boolean;
  snapshotErrorMessage: string | null;
  isChangingStatus: boolean;
  statusErrorMessage: string | null;
  onChangeStatus: (
    corporationId: string,
    input: {
      status: "dissolved" | "merged_out";
      effective_date?: string | null;
      surviving_corporation_id?: string | null;
      evidence?: string | null;
    },
  ) => Promise<boolean>;
  isCorrectingHistory: boolean;
  correctionErrorMessage: string | null;
  onCorrectHistory: (
    corporationId: string,
    input: {
      as_of: string;
      name?: string | null;
      representative_name?: string | null;
      corporate_number?: string | null;
      address?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
      evidence: string;
    },
  ) => Promise<boolean>;
}

/** 法人の変更履歴タイムライン・時点参照・解散/合併・過去履歴訂正パネル。 */
export function CorporationHistoryPanel({
  section = "all",
  corporation,
  activeCorporations,
  historyRecords,
  isLoadingHistory,
  historyErrorMessage,
  snapshotParams,
  onLookupSnapshot,
  snapshotCorporation,
  isLoadingSnapshot,
  snapshotErrorMessage,
  isChangingStatus,
  statusErrorMessage,
  onChangeStatus,
  isCorrectingHistory,
  correctionErrorMessage,
  onCorrectHistory,
}: CorporationHistoryPanelProps) {
  const [nextStatus, setNextStatus] = useState<"dissolved" | "merged_out">("dissolved");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [survivingId, setSurvivingId] = useState("");
  const [statusEvidence, setStatusEvidence] = useState("");
  const [statusFormError, setStatusFormError] = useState<string | undefined>(undefined);

  const [lookupAsOf, setLookupAsOf] = useState(snapshotParams?.as_of ?? "");
  const [lookupRecordedAsOf, setLookupRecordedAsOf] = useState(
    snapshotParams?.recorded_as_of ?? "",
  );

  const [correctAsOf, setCorrectAsOf] = useState("");
  const [correctName, setCorrectName] = useState("");
  const [correctRepresentativeName, setCorrectRepresentativeName] = useState("");
  const [correctCorpNumber, setCorrectCorpNumber] = useState("");
  const [correctAddress, setCorrectAddress] = useState("");
  const [correctValidFrom, setCorrectValidFrom] = useState("");
  const [correctValidTo, setCorrectValidTo] = useState("");
  const [correctEvidence, setCorrectEvidence] = useState("");
  const [correctFormError, setCorrectFormError] = useState<string | undefined>(undefined);
  const [baselineRecord, setBaselineRecord] = useState<CorporationHistoryRecord | null>(null);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

  const survivingOptions: readonly SelectOption[] = [
    { value: "", label: "存続法人を選択してください" },
    ...activeCorporations
      .filter((candidate) => candidate.id !== corporation.id)
      .map((candidate) => ({
        value: candidate.id,
        label: formatCorporationOptionLabel(candidate),
      })),
  ];

  async function handleStatusSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextStatus === "merged_out" && !survivingId.trim()) {
      setStatusFormError("吸収合併の場合は合併先の存続法人を指定してください。");
      return;
    }
    setStatusFormError(undefined);
    const ok = await onChangeStatus(corporation.id, {
      status: nextStatus,
      effective_date: effectiveDate.trim() || undefined,
      surviving_corporation_id: nextStatus === "merged_out" ? survivingId.trim() : null,
      evidence: statusEvidence.trim() || undefined,
    });
    if (ok) {
      setEffectiveDate("");
      setSurvivingId("");
      setStatusEvidence("");
    }
  }

  function handleLookupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asOf = lookupAsOf.trim() || undefined;
    const rawRecorded = lookupRecordedAsOf.trim();
    const recordedAsOf = rawRecorded
      ? rawRecorded.length === 16
        ? `${rawRecorded}:00+09:00`
        : rawRecorded
      : undefined;
    if (!asOf && !recordedAsOf) {
      onLookupSnapshot(null);
      return;
    }
    onLookupSnapshot({ as_of: asOf, recorded_as_of: recordedAsOf });
  }

  async function handleCorrectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctAsOf.trim()) {
      setCorrectFormError("訂正対象の基準日 (as_of) を入力してください。");
      return;
    }
    if (!correctEvidence.trim()) {
      setCorrectFormError("履歴訂正の根拠 (evidence) を入力してください。");
      return;
    }
    setCorrectFormError(undefined);
    const payload: {
      as_of: string;
      name?: string | null;
      representative_name?: string | null;
      corporate_number?: string | null;
      address?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
      evidence: string;
    } = {
      as_of: correctAsOf.trim(),
      evidence: correctEvidence.trim(),
    };
    const trimmedName = correctName.trim();
    const trimmedRepresentativeName = correctRepresentativeName.trim();
    const trimmedNumber = correctCorpNumber.trim();
    const trimmedAddress = correctAddress.trim();
    const trimmedValidFrom = correctValidFrom.trim();
    const trimmedValidTo = correctValidTo.trim();

    if (baselineRecord) {
      if (trimmedName && trimmedName !== baselineRecord.corporation.name) {
        payload.name = trimmedName;
      }
      if (
        trimmedRepresentativeName &&
        trimmedRepresentativeName !== baselineRecord.corporation.representative_name
      ) {
        payload.representative_name = trimmedRepresentativeName;
      }
      if (trimmedNumber !== (baselineRecord.corporation.corporate_number ?? "")) {
        payload.corporate_number = trimmedNumber || null;
      }
      if (trimmedAddress !== baselineRecord.corporation.address) {
        payload.address = trimmedAddress;
      }
      if (trimmedValidFrom && trimmedValidFrom !== baselineRecord.valid_from) {
        payload.valid_from = trimmedValidFrom;
      }
      if (trimmedValidTo !== (baselineRecord.valid_to ?? "")) {
        payload.valid_to = trimmedValidTo || null;
      }
    } else {
      if (trimmedName) payload.name = trimmedName;
      if (trimmedRepresentativeName) payload.representative_name = trimmedRepresentativeName;
      if (trimmedNumber) payload.corporate_number = trimmedNumber;
      if (trimmedAddress) payload.address = trimmedAddress;
      if (trimmedValidFrom) payload.valid_from = trimmedValidFrom;
      if (trimmedValidTo) payload.valid_to = trimmedValidTo;
    }

    const ok = await onCorrectHistory(corporation.id, payload);
    if (ok) {
      setCorrectEvidence("");
      setBaselineRecord(null);
    }
  }

  function prefillCorrection(record: CorporationHistoryRecord) {
    setBaselineRecord(record);
    setCorrectAsOf(record.valid_from);
    setCorrectName(record.corporation.name);
    setCorrectRepresentativeName(record.corporation.representative_name);
    setCorrectCorpNumber(record.corporation.corporate_number ?? "");
    setCorrectAddress(record.corporation.address);
    setCorrectValidFrom(record.valid_from);
    setCorrectValidTo(record.valid_to ?? "");
    setCorrectFormError(undefined);
    setIsCorrectionOpen(true);
  }

  const showStatusSection =
    (section === "all" || section === "status") && corporation.status === "active";
  const showHistorySection = section === "all" || section === "history";

  return (
    <div {...stylex.props(s.formStack)}>
      {showStatusSection ? (
        <form
          onSubmit={(e) => void handleStatusSubmit(e)}
          noValidate
          {...stylex.props(s.dangerBox)}
        >
          <h3 {...stylex.props(s.subSectionTitle)}>解散・吸収合併（存続状態の変更）</h3>
          {statusFormError || statusErrorMessage ? (
            <Alert tone="error" title="状態変更を実行できませんでした" role="alert">
              <p>{statusFormError ?? statusErrorMessage}</p>
            </Alert>
          ) : null}
          <div {...stylex.props(s.formGrid)}>
            <Select
              label="変更後の状態"
              name={`status_next_${corporation.id}`}
              items={STATUS_TRANSITION_OPTIONS}
              value={nextStatus}
              onValueChange={(value) => {
                setNextStatus(value === "merged_out" ? "merged_out" : "dissolved");
                setStatusFormError(undefined);
              }}
              disabled={isChangingStatus}
            />
            <TextField
              label="効力日"
              name={`status_effective_${corporation.id}`}
              type="date"
              value={effectiveDate}
              onValueChange={setEffectiveDate}
              disabled={isChangingStatus}
            />
            {nextStatus === "merged_out" ? (
              <Select
                label="合併先の存続法人"
                name={`status_surviving_${corporation.id}`}
                items={survivingOptions}
                value={survivingId}
                onValueChange={(value) => {
                  setSurvivingId(value ?? "");
                  setStatusFormError(undefined);
                }}
                disabled={isChangingStatus}
              />
            ) : null}
            <TextField
              label="根拠・メモ"
              name={`status_evidence_${corporation.id}`}
              value={statusEvidence}
              onValueChange={setStatusEvidence}
              placeholder="例: 臨時株主総会決議 / 吸収合併契約"
              disabled={isChangingStatus}
            />
          </div>
          <div {...stylex.props(s.submitRow)}>
            <Button type="submit" variant="outlined" size="sm" disabled={isChangingStatus}>
              {isChangingStatus ? "変更中…" : "ステータスを変更"}
            </Button>
          </div>
        </form>
      ) : null}

      {showHistorySection ? (
        <>
          <div {...stylex.props(s.formStack)}>
            <h3 {...stylex.props(s.subSectionTitle)}>変更履歴タイムライン</h3>
            {isLoadingHistory ? (
              <Spinner label="変更履歴を読み込み中…" showLabel />
            ) : historyErrorMessage ? (
              <Alert tone="error" title="変更履歴を取得できませんでした" role="alert">
                {historyErrorMessage}
              </Alert>
            ) : historyRecords.length === 0 ? (
              <p {...stylex.props(s.sectionDescription)}>履歴レコードはありません。</p>
            ) : (
              <ul {...stylex.props(s.corpList)}>
                {historyRecords.map((record) => (
                  <li
                    key={`${record.recorded_at}-${record.kind}-${record.valid_from}`}
                    {...stylex.props(s.historyItem)}
                  >
                    <div {...stylex.props(s.corpItemHeader)}>
                      <div {...stylex.props(s.corpMainInfo)}>
                        <div {...stylex.props(s.corpTitleRow)}>
                          <Badge tone="neutral">{changeKindLabel(record.kind)}</Badge>
                          <strong>{record.corporation.name}</strong>
                          <Badge tone="neutral">{statusLabel(record.corporation.status)}</Badge>
                        </div>
                        <p {...stylex.props(s.metaGrid)}>
                          <span>
                            {record.corporation.category === "individual" ? "開設者" : "代表者"}:{" "}
                            {record.corporation.representative_name || "未設定"}
                          </span>
                          <span>
                            有効期間: {record.valid_from} 〜 {record.valid_to ?? "終了未定"}
                          </span>
                          <span>記録日時: {record.recorded_at}</span>
                          <span>変更者: {record.recorded_by ?? "不明"}</span>
                          {record.surviving_corporation_id ? (
                            <span>合併先ID: {record.surviving_corporation_id}</span>
                          ) : null}
                          <span>根拠: {record.evidence || "未記録"}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        onClick={() => prefillCorrection(record)}
                      >
                        この記録を訂正
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details
            open={isLookupOpen}
            onToggle={(e) => setIsLookupOpen(e.currentTarget.open)}
            {...stylex.props(s.detailsBox)}
          >
            <summary {...stylex.props(s.detailsSummary)}>過去時点の状態を照会</summary>
            <form onSubmit={handleLookupSubmit} noValidate {...stylex.props(s.detailsBody)}>
              <div {...stylex.props(s.formGrid)}>
                <TextField
                  label="基準日"
                  name={`lookup_as_of_${corporation.id}`}
                  type="date"
                  value={lookupAsOf}
                  onValueChange={setLookupAsOf}
                />
                <TextField
                  label="記録日時（任意）"
                  name={`lookup_recorded_${corporation.id}`}
                  type="datetime-local"
                  value={lookupRecordedAsOf}
                  onValueChange={setLookupRecordedAsOf}
                />
              </div>
              <div {...stylex.props(s.submitRow)}>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  onClick={() => {
                    setLookupAsOf("");
                    setLookupRecordedAsOf("");
                    onLookupSnapshot(null);
                  }}
                >
                  条件をクリア
                </Button>
                <Button type="submit" variant="outlined" size="sm">
                  時点照会
                </Button>
              </div>
              {isLoadingSnapshot ? (
                <Spinner label="指定時点の法人情報を照会中…" showLabel />
              ) : snapshotErrorMessage ? (
                <Alert tone="warning" title="指定時点の履歴が見つかりませんでした">
                  {snapshotErrorMessage}
                </Alert>
              ) : snapshotCorporation ? (
                <div {...stylex.props(s.snapshotBox)}>
                  <p {...stylex.props(s.metaGrid)}>
                    <strong>{snapshotCorporation.name}</strong>
                    <span>状態: {statusLabel(snapshotCorporation.status)}</span>
                    <span>
                      {snapshotCorporation.category === "individual" ? "開設者" : "代表者"}:{" "}
                      {snapshotCorporation.representative_name || "未設定"}
                    </span>
                    <span>法人番号: {snapshotCorporation.corporate_number ?? "未設定"}</span>
                    <span>所在地: {snapshotCorporation.address || "未設定"}</span>
                    <span>
                      有効期間: {snapshotCorporation.valid_from ?? "未設定"} 〜{" "}
                      {snapshotCorporation.valid_to ?? "終了未定"}
                    </span>
                  </p>
                </div>
              ) : null}
            </form>
          </details>

          <details
            open={isCorrectionOpen}
            onToggle={(e) => setIsCorrectionOpen(e.currentTarget.open)}
            {...stylex.props(s.detailsBox)}
          >
            <summary {...stylex.props(s.detailsSummary)}>過去履歴の訂正</summary>
            <form
              onSubmit={(e) => void handleCorrectSubmit(e)}
              noValidate
              {...stylex.props(s.detailsBody)}
            >
              {correctFormError || correctionErrorMessage ? (
                <Alert tone="error" title="履歴訂正に失敗しました" role="alert">
                  <p>{correctFormError ?? correctionErrorMessage}</p>
                </Alert>
              ) : null}
              <div {...stylex.props(s.formGrid)}>
                <TextField
                  label="訂正対象日"
                  name={`correct_as_of_${corporation.id}`}
                  type="date"
                  value={correctAsOf}
                  onValueChange={setCorrectAsOf}
                  required
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="訂正後の法人名"
                  name={`correct_name_${corporation.id}`}
                  value={correctName}
                  onValueChange={setCorrectName}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label={
                    corporation.category === "individual"
                      ? "訂正後の開設者氏名"
                      : "訂正後の代表者名"
                  }
                  name={`correct_representative_name_${corporation.id}`}
                  value={correctRepresentativeName}
                  onValueChange={setCorrectRepresentativeName}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="訂正後の法人番号"
                  name={`correct_number_${corporation.id}`}
                  value={correctCorpNumber}
                  onValueChange={setCorrectCorpNumber}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="訂正後の所在地"
                  name={`correct_address_${corporation.id}`}
                  value={correctAddress}
                  onValueChange={setCorrectAddress}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="有効開始日"
                  name={`correct_valid_from_${corporation.id}`}
                  type="date"
                  value={correctValidFrom}
                  onValueChange={setCorrectValidFrom}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="有効終了日"
                  name={`correct_valid_to_${corporation.id}`}
                  type="date"
                  value={correctValidTo}
                  onValueChange={setCorrectValidTo}
                  disabled={isCorrectingHistory}
                />
                <TextField
                  label="訂正の根拠"
                  name={`correct_evidence_${corporation.id}`}
                  value={correctEvidence}
                  onValueChange={setCorrectEvidence}
                  placeholder="例: 登記簿記載の修正"
                  required
                  disabled={isCorrectingHistory}
                />
              </div>
              <div {...stylex.props(s.submitRow)}>
                <Button type="submit" variant="outlined" size="sm" disabled={isCorrectingHistory}>
                  {isCorrectingHistory ? "訂正中…" : "履歴を訂正"}
                </Button>
              </div>
            </form>
          </details>
        </>
      ) : null}
    </div>
  );
}
