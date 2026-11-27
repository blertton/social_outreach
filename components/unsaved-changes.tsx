"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";

type Changes = { register: (id: string, dirty: boolean) => void; confirmLeave: () => boolean };
const Context = createContext<Changes>({ register: () => {}, confirmLeave: () => true });

// One registry for the page: saving one editor must not clear another's warning.
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyEditors = useRef(new Set<string>());
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtyEditors.current.add(id);
    else dirtyEditors.current.delete(id);
  }, []);
  const confirmLeave = useCallback(() => dirtyEditors.current.size === 0 ||
    window.confirm("You have unsaved reply changes. Leave without saving?"), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyEditors.current.size > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return <Context.Provider value={{ register, confirmLeave }}>{children}</Context.Provider>;
}

export function useUnsavedChanges(id: string, dirty: boolean) {
  const { register } = useContext(Context);
  useEffect(() => {
    register(id, dirty);
    return () => register(id, false);
  }, [id, dirty, register]);
}

export function GuardedLink(props: ComponentProps<typeof Link>) {
  const { confirmLeave } = useContext(Context);
  return <Link {...props} onNavigate={(event) => {
    if (!confirmLeave()) event.preventDefault();
    else props.onNavigate?.(event);
  }} />;
}

export function GuardedForm(props: ComponentProps<"form">) {
  const { confirmLeave } = useContext(Context);
  return <form {...props} onSubmit={(event) => {
    if (!confirmLeave()) event.preventDefault();
    else props.onSubmit?.(event);
  }} />;
}
