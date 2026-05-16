import type { DbGoalSheet } from "@/lib/db/schema";
import type { Role } from "@/lib/auth/session";

export type SheetStatus = DbGoalSheet["status"];

export type Transition =
  | "submit"
  | "open_review"
  | "return"
  | "approve"
  | "unlock"
  | "reopen"
  | "edit_draft";

export function canTransition(
  status: SheetStatus,
  transition: Transition,
  role: Role
): { ok: true } | { ok: false; reason: string } {
  switch (transition) {
    case "edit_draft":
      if (status === "draft" || status === "reopened") return { ok: true };
      return { ok: false, reason: `Cannot edit a ${status} sheet without admin unlock.` };
    case "submit":
      if (role !== "employee" && role !== "admin")
        return { ok: false, reason: "Only the goal owner can submit." };
      if (status === "draft" || status === "reopened") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; cannot submit.` };
    case "open_review":
      if (role === "employee") return { ok: false, reason: "Manager-only." };
      if (status === "submitted") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; cannot open review.` };
    case "return":
      if (role === "employee") return { ok: false, reason: "Manager-only." };
      if (status === "submitted" || status === "in_review") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; cannot return.` };
    case "approve":
      if (role === "employee") return { ok: false, reason: "Manager-only." };
      if (status === "submitted" || status === "in_review") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; cannot approve.` };
    case "unlock":
      if (role !== "admin") return { ok: false, reason: "Admin-only." };
      if (status === "approved" || status === "locked") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; nothing to unlock.` };
    case "reopen":
      if (role !== "admin") return { ok: false, reason: "Admin-only." };
      if (status === "locked" || status === "approved") return { ok: true };
      return { ok: false, reason: `Sheet is ${status}; cannot reopen.` };
  }
}

export function nextStatus(status: SheetStatus, transition: Transition): SheetStatus {
  switch (transition) {
    case "submit":
      return "submitted";
    case "open_review":
      return "in_review";
    case "return":
      return "draft";
    case "approve":
      return "locked";
    case "unlock":
    case "reopen":
      return "reopened";
    case "edit_draft":
      return status;
  }
}

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  in_review: "In review",
  approved: "Approved",
  locked: "Locked",
  reopened: "Reopened",
};

export const SHEET_STATUS_TONES: Record<SheetStatus, "neutral" | "info" | "warn" | "success" | "danger"> = {
  draft: "neutral",
  submitted: "info",
  in_review: "info",
  approved: "success",
  locked: "success",
  reopened: "warn",
};
