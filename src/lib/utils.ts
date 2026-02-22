import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRT_TZ = "America/Sao_Paulo";

/** Format date in BRT timezone: dd/MM/yyyy */
export function formatDateBRT(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: BRT_TZ, ...options });
}

/** Format date+time in BRT timezone */
export function formatDateTimeBRT(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", { timeZone: BRT_TZ });
}

/** Format time only in BRT timezone */
export function formatTimeBRT(date: string | Date): string {
  return new Date(date).toLocaleTimeString("pt-BR", { timeZone: BRT_TZ, hour: "2-digit", minute: "2-digit" });
}

/** Get current date in BRT as YYYY-MM-DD */
export function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRT_TZ });
}

/** Get current BRT Date object offset */
export function nowBRT(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: BRT_TZ }));
}
