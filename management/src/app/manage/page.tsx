"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/ui/Loading";

export default function ManageRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/manage/editor");
  }, [router]);

  return <Loading message="リダイレクト中..." />;
}
