"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { SchoolContextProvider } from "@/providers/SchoolContextProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default function ManageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <SchoolContextProvider>
        <ToastProvider>{children}</ToastProvider>
      </SchoolContextProvider>
    </AuthProvider>
  );
}
