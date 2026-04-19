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
}

interface AdManagerProps {
  docRef: DocumentReference;
  ads: AdItem[];
  onAdsChange: (ads: AdItem[]) => void;
  title?: string;
  description?: string;
  maxAds?: number;
}

export function AdManager({
  docRef,
  ads,
  onAdsChange,
  title = "広告管理",
  description,
  maxAds = 5,
}: AdManagerProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "add" | { type: "replace"; index: number } | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveAds = useCallback(
    async (newAds: AdItem[]) => {
      const snap = await getDoc(docRef);
      const current = snap.exists()
        ? snap.data().displaySettings || {}
        : {};
      const nextSettings = { ...current, ads: newAds };
      if (snap.exists()) {
        await updateDoc(docRef, { displaySettings: nextSettings });
      } else {
        await setDoc(
          docRef,
          { displaySettings: nextSettings },
          { merge: true }
        );
      }
    },
    [docRef]
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
    const linkUrl = (linkInput?.value || "").trim();
    const duration = parseInt(durationInput?.value || "10", 10);

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

    const isVideo = file.type.startsWith("video/");
    setSaving(true);
    try {
      const folder = isVideo ? "videos" : "ads";
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
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
        {description || `最大${maxAds}枚まで。画像または動画をアップロードできます。`}
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
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
