import type { Role } from "@/lib/auth/session";

export type Action =
  | "cycle.create"
  | "cycle.update"
  | "cycle.list"
  | "thrustArea.crud"
  | "goalSheet.create"
  | "goalSheet.read"
  | "goalSheet.update"
  | "goalSheet.submit"
  | "goalSheet.review.edit"
  | "goalSheet.return"
  | "goalSheet.approve"
  | "goalSheet.unlock"
  | "goalSheet.reopen"
  | "sharedGoal.push"
  | "sharedGoal.subscribe"
  | "checkIn.submit"
  | "checkIn.manager.acknowledge"
  | "audit.read"
  | "export.generate"
  | "analytics.read"
  | "escalationRule.crud"
  | "notification.read"
  | "copilot.invoke"
  | "graph.sync";

export type Scope = "self" | "report" | "org" | "deny";

export const matrix: Record<Action, Record<Role, Scope>> = {
  "cycle.create":               { employee: "deny",   manager: "deny",   admin: "org"  },
  "cycle.update":               { employee: "deny",   manager: "deny",   admin: "org"  },
  "cycle.list":                 { employee: "org",    manager: "org",    admin: "org"  },
  "thrustArea.crud":            { employee: "deny",   manager: "deny",   admin: "org"  },
  "goalSheet.create":           { employee: "self",   manager: "deny",   admin: "org"  },
  "goalSheet.read":             { employee: "self",   manager: "report", admin: "org"  },
  "goalSheet.update":           { employee: "self",   manager: "deny",   admin: "org"  },
  "goalSheet.submit":           { employee: "self",   manager: "deny",   admin: "deny" },
  "goalSheet.review.edit":      { employee: "deny",   manager: "report", admin: "org"  },
  "goalSheet.return":           { employee: "deny",   manager: "report", admin: "org"  },
  "goalSheet.approve":          { employee: "deny",   manager: "report", admin: "org"  },
  "goalSheet.unlock":           { employee: "deny",   manager: "deny",   admin: "org"  },
  "goalSheet.reopen":           { employee: "deny",   manager: "deny",   admin: "org"  },
  "sharedGoal.push":            { employee: "deny",   manager: "report", admin: "org"  },
  "sharedGoal.subscribe":       { employee: "self",   manager: "report", admin: "org"  },
  "checkIn.submit":             { employee: "self",   manager: "deny",   admin: "deny" },
  "checkIn.manager.acknowledge":{ employee: "deny",   manager: "report", admin: "org"  },
  "audit.read":                 { employee: "self",   manager: "report", admin: "org"  },
  "export.generate":            { employee: "self",   manager: "report", admin: "org"  },
  "analytics.read":             { employee: "self",   manager: "report", admin: "org"  },
  "escalationRule.crud":        { employee: "deny",   manager: "deny",   admin: "org"  },
  "notification.read":          { employee: "self",   manager: "self",   admin: "self" },
  "copilot.invoke":             { employee: "self",   manager: "report", admin: "org"  },
  "graph.sync":                 { employee: "deny",   manager: "deny",   admin: "org"  },
};
