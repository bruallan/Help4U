import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function parseExcelDate(val: unknown): Date | null {
  if (!val) return null;

  if (typeof val === "number") {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }

  if (typeof val === "string") {
    const parts = val.trim().split(" ");
    const datePart = parts[0];
    const timePart = parts[1];

    if (!datePart) return null;

    const dateParts = datePart.includes("/")
      ? datePart.split("/")
      : datePart.split("-");
    if (dateParts.length !== 3) return null;

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    let year = parseInt(dateParts[2], 10);

    if (year < 100) {
      year += 2000;
    }

    let hours = 0,
      minutes = 0,
      seconds = 0;
    if (timePart) {
      const timeParts = timePart.split(":");
      hours = parseInt(timeParts[0] || "0", 10);
      minutes = parseInt(timeParts[1] || "0", 10);
      seconds = parseInt(timeParts[2] || "0", 10);
    }

    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(date.getTime()) ? null : date;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  return null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
