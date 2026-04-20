"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { copyMasterToClassesFn } from "@/lib/firebase-functions";
import { getTodayString } from "@/lib/utils";

type ContentType = "schedules" | "notices" | "assignments" | "all";
type SourceLevel = "school" | "grade";

interface MasterCopyButtonProps {
    schoolId: string;
    /** sourceLevel="grade" のとき必須 */
    gradeId?: string;
    sourceLevel: SourceLevel;
}

/**
 * マスターコンテンツを配下の全クラスに一括コピーするボタン。
 *
 * 押下するとモーダルが開き、対象日・コンテンツ種別を選んで実行する。
 * Cloud Function `copyMasterToClasses` を呼び出す。
 */
export function MasterCopyButton({
    schoolId,
    gradeId,
    sourceLevel,
}: MasterCopyButtonProps) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [dateStr, setDateStr] = useState<string>(getTodayString());
    const [contentType, setContentType] = useState<ContentType>("all");
    const [running, setRunning] = useState(false);

    const levelLabel = sourceLevel === "school" ? "学校" : "学年";

    const handleRun = async () => {
        if (running) return;
        setRunning(true);
        try {
            const result = await copyMasterToClassesFn({
                schoolId,
                gradeId: sourceLevel === "grade" ? gradeId : undefined,
                sourceLevel,
                contentType,
                dateStr,
            });
            if (result.data.success) {
                showToast(
                    `${levelLabel}マスターの内容を各クラスにコピーしました`,
                    "success"
                );
                setOpen(false);
            } else {
                showToast("コピーに失敗しました", "error");
            }
        } catch (e) {
            showToast((e as Error).message || "コピーに失敗しました", "error");
        } finally {
            setRunning(false);
        }
    };

    // sourceLevel=grade で gradeId が無い場合はボタン自体を出さない
    if (sourceLevel === "grade" && !gradeId) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-line-strong)",
                    background: "var(--color-canvas)",
                    color: "var(--color-text)",
                    fontSize: "var(--fs-sm)",
                    fontWeight: 500,
                    cursor: "pointer",
                }}
            >
                各クラスにコピー…
            </button>

            <Modal
                isOpen={open}
                onClose={() => (running ? null : setOpen(false))}
                title={`${levelLabel}マスターを各クラスへコピー`}
                description={`${levelLabel}マスターの指定日のデータを配下の全クラスの daily_data に追記します（既存データは保持）。`}
                footer={
                    <>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setOpen(false)}
                            disabled={running}
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleRun}
                            disabled={running}
                        >
                            {running ? "実行中..." : "コピーを実行"}
                        </button>
                    </>
                }
            >
                <div style={{ display: "grid", gap: 14 }}>
                    <label style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                            対象日
                        </span>
                        <input
                            type="date"
                            value={dateStr}
                            onChange={(e) => setDateStr(e.target.value)}
                            disabled={running}
                            style={{
                                padding: "8px 10px",
                                border: "1px solid var(--color-line)",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "var(--fs-md)",
                            }}
                        />
                    </label>

                    <fieldset
                        style={{
                            border: "1px solid var(--color-line)",
                            borderRadius: "var(--radius-sm)",
                            padding: 10,
                        }}
                    >
                        <legend
                            style={{
                                fontSize: "var(--fs-sm)",
                                fontWeight: 600,
                                padding: "0 6px",
                            }}
                        >
                            コピーする内容
                        </legend>
                        {(
                            [
                                { key: "all", label: "全て（予定・連絡・提出物）" },
                                { key: "schedules", label: "予定のみ" },
                                { key: "notices", label: "連絡のみ" },
                                { key: "assignments", label: "提出物のみ" },
                            ] as { key: ContentType; label: string }[]
                        ).map((opt) => (
                            <label
                                key={opt.key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "4px 0",
                                    fontSize: "var(--fs-sm)",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="content-type"
                                    value={opt.key}
                                    checked={contentType === opt.key}
                                    onChange={() => setContentType(opt.key)}
                                    disabled={running}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </fieldset>

                    <p
                        style={{
                            fontSize: "var(--fs-xs)",
                            color: "var(--color-text-muted)",
                            margin: 0,
                        }}
                    >
                        ヒント: 各クラスで個別に編集させたい場合に使います。通常の「まとめて編集」はコピー不要です（サイネージ表示時に自動マージされます）。
                    </p>
                </div>
            </Modal>
        </>
    );
}
