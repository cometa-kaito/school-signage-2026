"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  Suspense,
} from "react";
import {
  useSchoolContext,
  type SchoolContextState,
} from "@/hooks/useSchoolContext";

const SchoolContext = createContext<SchoolContextState | null>(null);

function SchoolContextInner({ children }: { children: ReactNode }) {
  const schoolContext = useSchoolContext();
  return (
    <SchoolContext.Provider value={schoolContext}>
      {children}
    </SchoolContext.Provider>
  );
}

export function SchoolContextProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SchoolContextInner>{children}</SchoolContextInner>
    </Suspense>
  );
}

export function useSchoolContextValue(): SchoolContextState {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    throw new Error(
      "useSchoolContextValue must be used within SchoolContextProvider"
    );
  }
  return ctx;
}
