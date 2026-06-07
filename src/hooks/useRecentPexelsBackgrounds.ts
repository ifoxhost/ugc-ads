import { useState, useCallback } from "react";

export interface RecentBackground {
  url: string;
  thumbnail: string;
  type: "photo" | "video";
  photographer: string;
}

const STORAGE_KEY = "beatframe_recent_pexels";
const MAX_RECENT = 5;

function loadRecent(): RecentBackground[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentBackground[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentBackground[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function useRecentPexelsBackgrounds() {
  const [recents, setRecents] = useState<RecentBackground[]>(loadRecent);

  const addRecent = useCallback((item: RecentBackground) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.url !== item.url);
      const updated = [item, ...filtered].slice(0, MAX_RECENT);
      saveRecent(updated);
      return updated;
    });
  }, []);

  const clearRecents = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecents([]);
  }, []);

  return { recents, addRecent, clearRecents };
}
