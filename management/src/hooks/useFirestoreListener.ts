// hooks/useFirestoreListener.ts - Firestoreリアルタイムリスナーhook

"use client";

import { useState, useEffect } from "react";
import {
  onSnapshot,
  type Query,
  type DocumentReference,
  type DocumentData,
} from "firebase/firestore";

interface UseFirestoreDocResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/** 単一ドキュメントのリアルタイムリスナー */
export function useFirestoreDoc<T = DocumentData>(
  docRef: DocumentReference | null
): UseFirestoreDocResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) {
      // docRef が外れた場合の状態リセット（購読解除相当）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

/** コレクション/クエリのリアルタイムリスナー */
export function useFirestoreCollection<T = DocumentData>(
  query: Query | null
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      // query が外れた場合の状態リセット
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as T
        );
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore collection listener error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]); // Caller must memoize query

  return { data, loading, error };
}
