"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// Keep auth fields disabled until hydration can preserve typed input.
export function useFormReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
