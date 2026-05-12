"use client";

import { useState, useRef, useCallback } from "react";
import {
  getDoc,
  updateDoc,
  setDoc,
  type DocumentReference,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import styles from "@/styles/class-settings.module.css";

export interface AdItem {
  id: string;
  type: "image" | "video";
  url: string;
  link_url?: string;
  duration_sec?: number;
  caption?: string;
  caption_font_scale?: number;
}

const CAPTION_FONT_SCALE_OPTIONS = [
  { value: 0.85, label: "小" },
  { value: 1, label: "標準" },
  { value: 1.3, label: "大" },
  { value: 1.6, label: "特大" },
] as const;
const CAPTION_FONT_SCALE_VALUES = CAPTION_FONT_SCALE_OPTIONS.map((o) => o.value);

/**
 * PDFの1ページ目を白背景PNGのBlobに変換する。
 * - pdfjs-dist を動的importしてバンドル分離
 * - Workerは pdfjs.version に対応するCDNからロード（Turbopack/staticExport両対応）
 * - サイネージ向けに横1920pxを目標解像度とする（最大4倍）
 */
async function convertPdfFirstPageToPng(file: File): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1920 / baseViewport.width, 4);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvasコンテキストが取得できません");

    // 透明PDFが暗くならないように白背景を敷く
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) throw new Error("PDFの画像変換に失敗しました");
    return blob;
  } finally {
    await pdf.destroy();
  }
}

interface AdManagerProps {
  docRef: DocumentReference;
  /** 同じ広告内容を並行書き込みする追加の書込先。読み込みは docRef から */
  extraDocRefs?: DocumentReference[];
  ads: AdItem[];
  onAdsChange: (ads: AdItem[]) => void;
  title?: string;
  description?: string;
  maxAds?: number;
}

export function AdManager({
  docRef,
  extraDocRefs,
  ads,
  onAdsChange,
  title = "広告管理",
  description,
  maxAds = 20,
}: AdManagerProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "add" | { type: "replace"; index: number } | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveAds = useCallback(
    async (newAds: AdItem[]) => {
      const writeTo = async (ref: DocumentReference) => {
        const snap = await getDoc(ref);
        const current = snap.exists() ? snap.data().displaySettings || {} : {};
        const nextSettings = { ...current, ads: newAds };
        if (snap.exists()) {
          await updateDoc(ref, { displaySettings: nextSettings });
        } else {
          await setDoc(
            ref,
            { displaySettings: nextSettings },
            { merge: true }
          );
        }
      };
      await writeTo(docRef);
      if (extraDocRefs && extraDocRefs.length > 0) {
        await Promise.all(extraDocRefs.map(writeTo));
      }
    },
    [docRef, extraDocRefs]
  );

  const handleMoveAd = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ads.length) return;
    setSaving(true);
    try {
      const newAds = [...ads];
      [newAds[index], newAds[newIndex]] = [newAds[newIndex], newAds[index]];
      await saveAds(newAds);
      onAdsChange(newAds);
      showToast("並び順を変更しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleAddClick = () => {
    if (ads.length >= maxAds) {
      showToast(`最大${maxAds}枚です`, "error");
      return;
    }
    setPendingAction("add");
    fileInputRef.current?.click();
  };

  const handleReplaceClick = (index: number) => {
    setPendingAction({ type: "replace", index });
    fileInputRef.current?.click();
  };

  const handleDeleteAd = async (index: number) => {
    if (!confirm("削除しますか？")) return;
    setSaving(true);
    try {
      const newAds = [...ads];
      newAds.splice(index, 1);
      await saveAds(newAds);
      onAdsChange(newAds);
      showToast("削除しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleSaveAdSettings = async (index: number) => {
    const ad = ads[index];
    const uid = `${docRef.path}-${index}`;
    const linkInput = document.getElementById(
      `ad-link-${uid}`
    ) as HTMLInputElement | null;
    const durationInput = document.getElementById(
      `ad-duration-${uid}`
    ) as HTMLInputElement | null;
    const captionInput = document.getElementById(
      `ad-caption-${uid}`
    ) as HTMLInputElement | null;
    const fontScaleInput = document.getElementById(
      `ad-caption-scale-${uid}`
    ) as HTMLSelectElement | null;
    const linkUrl = (linkInput?.value || "").trim();
    const duration = parseInt(durationInput?.value || "10", 10);
    const caption = (captionInput?.value || "").trim().slice(0, 60);
    const fontScaleRaw = parseFloat(fontScaleInput?.value || "1");
    const captionFontScale = CAPTION_FONT_SCALE_VALUES.includes(
      fontScaleRaw as (typeof CAPTION_FONT_SCALE_VALUES)[number]
    )
      ? fontScaleRaw
      : 1;

    if (linkUrl && !/^https?:\/\//.test(linkUrl)) {
      showToast("URLは http:// または https:// で始めてください", "error");
      return;
    }

    setSaving(true);
    try {
      const newAds = [...ads];
      newAds[index] = {
        ...ad,
        link_url: linkUrl,
        duration_sec: Math.max(3, Math.min(120, duration)),
        caption,
        caption_font_scale: captionFontScale,
      };
      await saveAds(newAds);
      onAdsChange(newAds);
      showToast("設定を保存しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      // PDFはブラウザ側で1ページ目をPNG化してから既存の画像アップロード経路に流す
      let uploadFile: File = file;
      let isVideo = file.type.startsWith("video/");
      if (file.type === "application/pdf") {
        const pngBlob = await convertPdfFirstPageToPng(file);
        const baseName = file.name.replace(/\.pdf$/i, "");
        uploadFile = new File([pngBlob], `${baseName}.png`, {
          type: "image/png",
        });
        isVideo = false;
      }

      const folder = isVideo ? "videos" : "ads";
      const storageRef = ref(
        storage,
        `${folder}/${Date.now()}_${uploadFile.name}`
      );
      await uploadBytes(storageRef, uploadFile);
      const url = await getDownloadURL(storageRef);
      const newAd: AdItem = {
        id: `ad_${Date.now()}`,
        type: isVideo ? "video" : "image",
        url,
        link_url: "",
        duration_sec: isVideo ? 0 : 10,
      };

      const newAds = [...ads];
      if (pendingAction === "add") {
        newAds.push(newAd);
      } else if (pendingAction && typeof pendingAction === "object") {
        newAds[pendingAction.index] = {
          ...newAds[pendingAction.index],
          ...newAd,
        };
      }

      await saveAds(newAds);
      onAdsChange(newAds);
      showToast("アップロードしました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
    setPendingAction(null);
    e.target.value = "";
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>{title}</h2>
        {ads.length < maxAds && (
          <button
            className="btn btn-primary"
            onClick={handleAddClick}
            disabled={saving}
          >
            + 広告追加
          </button>
        )}
      </div>
      <p className={styles.settingDescription}>
        {description ||
          `最大${maxAds}枚まで。画像・動画・PDFをアップロードできます（PDFは1ページ目を画像化します）。`}
      </p>

      {ads.length === 0 ? (
        <p className="empty-text">広告未登録</p>
      ) : (
        <div className={styles.adList}>
          {ads.map((ad, idx) => {
            const uid = `${docRef.path}-${idx}`;
            return (
              <div key={ad.id || idx} className={styles.adItem}>
                <div className={styles.adDragHandle}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleMoveAd(idx, "up")}
                    disabled={saving || idx === 0}
                    title="上に移動"
                    style={{ padding: "2px 6px", fontSize: "14px" }}
                  >
                    ▲
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleMoveAd(idx, "down")}
                    disabled={saving || idx === ads.length - 1}
                    title="下に移動"
                    style={{ padding: "2px 6px", fontSize: "14px" }}
                  >
                    ▼
                  </button>
                </div>
                {ad.type === "video" ? (
                  <video
                    src={ad.url}
                    className={styles.adThumbnail}
                    muted
                    playsInline
                    onMouseEnter={(e) =>
                      (e.target as HTMLVideoElement).play()
                    }
                    onMouseLeave={(e) => {
                      const v = e.target as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                ) : (
                  <img
                    src={ad.url}
                    className={styles.adThumbnail}
                    alt={`広告 ${idx + 1}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://placehold.jp/80x60.png?text=Error";
                    }}
                  />
                )}
                <div className={styles.adDetails}>
                  <p className={styles.adLabel}>
                    {ad.type === "video" ? "動画" : "画像"} {idx + 1}
                  </p>
                  <div className={styles.adSettingRow}>
                    <span className={styles.adSettingLabel}>URL:</span>
                    <input
                      type="text"
                      id={`ad-link-${uid}`}
                      placeholder="https://example.com"
                      defaultValue={ad.link_url || ""}
                      className={styles.adSettingInput}
                    />
                  </div>
                  <div className={styles.adSettingRow}>
                    <span className={styles.adSettingLabel}>キャプション:</span>
                    <input
                      type="text"
                      id={`ad-caption-${uid}`}
                      placeholder="例: 〇〇大学／株式会社〇〇（任意・60字以内）"
                      defaultValue={ad.caption || ""}
                      maxLength={60}
                      className={styles.adSettingInput}
                    />
                  </div>
                  <div className={styles.adSettingRow}>
                    <span className={styles.adSettingLabel}>文字サイズ:</span>
                    <select
                      id={`ad-caption-scale-${uid}`}
                      defaultValue={String(ad.caption_font_scale ?? 1)}
                      className={styles.adSettingInput}
                    >
                      {CAPTION_FONT_SCALE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.adSettingRow}>
                    <span className={styles.adSettingLabel}>表示秒数:</span>
                    <input
                      type="number"
                      id={`ad-duration-${uid}`}
                      defaultValue={ad.duration_sec || 10}
                      min={3}
                      max={120}
                      className={styles.adDurationInput}
                    />
                    <span className={styles.adSettingLabel}>秒</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleSaveAdSettings(idx)}
                      disabled={saving}
                      style={{ marginLeft: "auto" }}
                    >
                      設定を保存
                    </button>
                  </div>
                </div>
                <div className={styles.adActions}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleReplaceClick(idx)}
                    disabled={saving}
                  >
                    変更
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteAd(idx)}
                    disabled={saving}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*,application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
