import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * AtomicPulse schema (SQLite via Drizzle).
 * UUIDs as TEXT, timestamps as INTEGER unix-millis, JSON as TEXT.
 * Designed to mirror the Postgres design described in specs/db-schema.md
 * so a future migration is mechanical.
 */

const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" });

const nowDefault = sql`(unixepoch() * 1000)`;

// --- ORG ---
export const org = sqliteTable("org", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  entraTenantId: text("entra_tenant_id"),
  createdAt: ts("created_at").notNull().default(nowDefault),
});

// --- USER ---
export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id),
    entraOid: text("entra_oid").unique(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    managerId: text("manager_id"),
    role: text("role", { enum: ["employee", "manager", "admin"] }).notNull().default("employee"),
    department: text("department"),
    title: text("title"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastSeenAt: ts("last_seen_at"),
    createdAt: ts("created_at").notNull().default(nowDefault),
    updatedAt: ts("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    orgIdx: index("user_org_idx").on(t.orgId),
    managerIdx: index("user_manager_idx").on(t.managerId),
    roleIdx: index("user_role_idx").on(t.role),
  })
);

// --- THRUST AREA ---
export const thrustArea = sqliteTable(
  "thrust_area",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#2563EB"),
    icon: text("icon").default("target"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: ts("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    uniqOrgName: uniqueIndex("thrust_org_name_uniq").on(t.orgId, t.name),
  })
);

// --- GOAL CYCLE ---
export const goalCycle = sqliteTable(
  "goal_cycle",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => org.id),
    fyLabel: text("fy_label").notNull(),
    opensAt: ts("opens_at").notNull(),
    locksAt: ts("locks_at").notNull(),
    status: text("status", { enum: ["draft", "open", "locked", "closed"] })
      .notNull()
      .default("draft"),
    createdAt: ts("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    uniqOrgFy: uniqueIndex("cycle_org_fy_uniq").on(t.orgId, t.fyLabel),
  })
);

// --- CHECK-IN WINDOW ---
export const checkInWindow = sqliteTable(
  "check_in_window",
  {
    id: text("id").primaryKey(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => goalCycle.id),
    period: text("period", { enum: ["Q1", "Q2", "Q3", "Q4"] }).notNull(),
    opensAt: ts("opens_at").notNull(),
    closesAt: ts("closes_at").notNull(),
  },
  (t) => ({
    uniqCyclePeriod: uniqueIndex("window_cycle_period_uniq").on(t.cycleId, t.period),
  })
);

// --- GOAL SHEET ---
export const goalSheet = sqliteTable(
  "goal_sheet",
  {
    id: text("id").primaryKey(),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => goalCycle.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    managerId: text("manager_id").references(() => user.id),
    status: text("status", {
      enum: ["draft", "submitted", "in_review", "approved", "locked", "reopened"],
    })
      .notNull()
      .default("draft"),
    totalWeightageBp: integer("total_weightage_bp").notNull().default(0),
    submittedAt: ts("submitted_at"),
    reviewStartedAt: ts("review_started_at"),
    approvedAt: ts("approved_at"),
    lockedAt: ts("locked_at"),
    reopenedAt: ts("reopened_at"),
    returnedAt: ts("returned_at"),
    returnComment: text("return_comment"),
    approveComment: text("approve_comment"),
    createdAt: ts("created_at").notNull().default(nowDefault),
    updatedAt: ts("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    uniqCycleOwner: uniqueIndex("sheet_cycle_owner_uniq").on(t.cycleId, t.ownerId),
    ownerIdx: index("sheet_owner_idx").on(t.ownerId),
    managerIdx: index("sheet_manager_idx").on(t.managerId),
    statusIdx: index("sheet_status_idx").on(t.status),
  })
);

// --- SHARED GOAL LINK (parent record for shared goals) ---
export const sharedGoalLink = sqliteTable("shared_goal_link", {
  id: text("id").primaryKey(),
  primaryGoalId: text("primary_goal_id").notNull(),
  pushedById: text("pushed_by_id")
    .notNull()
    .references(() => user.id),
  pushedAt: ts("pushed_at").notNull().default(nowDefault),
  note: text("note"),
});

// --- GOAL ---
export const goal = sqliteTable(
  "goal",
  {
    id: text("id").primaryKey(),
    sheetId: text("sheet_id")
      .notNull()
      .references(() => goalSheet.id, { onDelete: "cascade" }),
    thrustAreaId: text("thrust_area_id")
      .notNull()
      .references(() => thrustArea.id),
    title: text("title").notNull(),
    description: text("description"),
    uomType: text("uom_type", {
      enum: ["min_num", "min_pct", "max_num", "max_pct", "timeline", "zero"],
    }).notNull(),
    targetValue: real("target_value"),
    targetDate: ts("target_date"),
    weightageBp: integer("weightage_bp").notNull().default(1000),
    status: text("status", { enum: ["not_started", "on_track", "completed"] })
      .notNull()
      .default("not_started"),
    currentActual: real("current_actual"),
    actualCompletionDate: ts("actual_completion_date"),
    computedScoreBp: integer("computed_score_bp"),
    source: text("source", { enum: ["self", "shared"] }).notNull().default("self"),
    sharedLinkId: text("shared_link_id"),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().default(nowDefault),
    updatedAt: ts("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    sheetIdx: index("goal_sheet_idx").on(t.sheetId),
    thrustIdx: index("goal_thrust_idx").on(t.thrustAreaId),
    sharedIdx: index("goal_shared_idx").on(t.sharedLinkId),
    statusIdx: index("goal_status_idx").on(t.status),
  })
);

// --- CHECK IN ---
export const checkIn = sqliteTable(
  "check_in",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["Q1", "Q2", "Q3", "Q4"] }).notNull(),
    actualValue: real("actual_value"),
    completionDate: ts("completion_date"),
    status: text("status", { enum: ["not_started", "on_track", "completed"] })
      .notNull()
      .default("not_started"),
    employeeNote: text("employee_note"),
    managerComment: text("manager_comment"),
    managerId: text("manager_id").references(() => user.id),
    employeeSubmittedAt: ts("employee_submitted_at"),
    managerAcknowledgedAt: ts("manager_acknowledged_at"),
    computedScoreBp: integer("computed_score_bp"),
    createdAt: ts("created_at").notNull().default(nowDefault),
    updatedAt: ts("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    uniqGoalPeriod: uniqueIndex("checkin_goal_period_uniq").on(t.goalId, t.period),
    goalIdx: index("checkin_goal_idx").on(t.goalId),
  })
);

// --- AUDIT EVENT (insert-only) ---
export const auditEvent = sqliteTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    entityType: text("entity_type", {
      enum: ["goal_sheet", "goal", "check_in", "cycle", "thrust_area", "user", "shared_goal"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    occurredAt: ts("occurred_at").notNull().default(nowDefault),
  },
  (t) => ({
    entityIdx: index("audit_entity_idx").on(t.entityId),
    orgTimeIdx: index("audit_org_time_idx").on(t.orgId, t.occurredAt),
    actionIdx: index("audit_action_idx").on(t.action),
  })
);

// --- APPROVAL EVENT (workflow audit, queryable by sheet) ---
export const approvalEvent = sqliteTable(
  "approval_event",
  {
    id: text("id").primaryKey(),
    sheetId: text("sheet_id")
      .notNull()
      .references(() => goalSheet.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action", { enum: ["submit", "return", "approve", "unlock", "reopen"] }).notNull(),
    comment: text("comment"),
    occurredAt: ts("occurred_at").notNull().default(nowDefault),
  },
  (t) => ({
    sheetIdx: index("approval_sheet_idx").on(t.sheetId),
  })
);

// --- ESCALATION ---
export const escalationRule = sqliteTable("escalation_rule", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => org.id),
  name: text("name").notNull(),
  trigger: text("trigger", { enum: ["no_submit", "no_approve", "no_checkin"] }).notNull(),
  thresholdDays: integer("threshold_days").notNull(),
  chainJson: text("chain_json").notNull(), // JSON: [{ to, afterDays }]
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at").notNull().default(nowDefault),
});

export const escalationEvent = sqliteTable(
  "escalation_event",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => escalationRule.id),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id),
    entityRef: text("entity_ref").notNull(),
    raisedAt: ts("raised_at").notNull().default(nowDefault),
    resolvedAt: ts("resolved_at"),
    status: text("status", { enum: ["open", "notified", "resolved", "cancelled"] })
      .notNull()
      .default("open"),
    notes: text("notes"),
  },
  (t) => ({
    ruleIdx: index("escal_rule_idx").on(t.ruleId),
    targetIdx: index("escal_target_idx").on(t.targetUserId),
    statusIdx: index("escal_status_idx").on(t.status),
  })
);

// --- NOTIFICATION ---
export const notification = sqliteTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    channel: text("channel", { enum: ["email", "teams", "in_app"] }).notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    payloadJson: text("payload_json"),
    createdAt: ts("created_at").notNull().default(nowDefault),
    readAt: ts("read_at"),
  },
  (t) => ({
    userIdx: index("notif_user_idx").on(t.userId),
    unreadIdx: index("notif_user_unread_idx").on(t.userId, t.readAt),
  })
);

// --- EMBEDDING (semantic search; vector stored as JSON array of floats) ---
export const embedding = sqliteTable(
  "embedding",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    contentHash: text("content_hash").notNull(),
    vectorJson: text("vector_json").notNull(),
    content: text("content").notNull(),
    updatedAt: ts("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entityType, t.entityId] }),
  })
);

export type DbOrg = typeof org.$inferSelect;
export type DbUser = typeof user.$inferSelect;
export type DbThrustArea = typeof thrustArea.$inferSelect;
export type DbGoalCycle = typeof goalCycle.$inferSelect;
export type DbCheckInWindow = typeof checkInWindow.$inferSelect;
export type DbGoalSheet = typeof goalSheet.$inferSelect;
export type DbGoal = typeof goal.$inferSelect;
export type DbCheckIn = typeof checkIn.$inferSelect;
export type DbAuditEvent = typeof auditEvent.$inferSelect;
export type DbApprovalEvent = typeof approvalEvent.$inferSelect;
export type DbNotification = typeof notification.$inferSelect;
export type DbEscalationRule = typeof escalationRule.$inferSelect;
export type DbEscalationEvent = typeof escalationEvent.$inferSelect;
