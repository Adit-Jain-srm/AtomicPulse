import { z } from "zod";

/**
 * BRD §2.1 validation rules — single source of truth (server + client).
 *
 * - Total weightage across all goals (including shared) must equal 100% (10000 bp).
 * - Minimum weightage per goal: 10% (1000 bp).
 * - Maximum number of goals per employee: 8.
 * - Shared goals count toward the total; recipients adjust own weights to accommodate.
 */

export const UomTypeEnum = z.enum(["min_num", "min_pct", "max_num", "max_pct", "timeline", "zero"]);
export const GoalStatusEnum = z.enum(["not_started", "on_track", "completed"]);

export const GoalDraftSchema = z.object({
  id: z.string().uuid().optional(),
  thrustAreaId: z.string().min(1, "Pick a thrust area"),
  title: z.string().min(3, "Title must be at least 3 characters").max(140),
  description: z.string().max(1200).optional().or(z.literal("")),
  uomType: UomTypeEnum,
  targetValue: z.number().nullable().optional(),
  targetDate: z.string().datetime().nullable().optional().or(z.literal("")),
  weightageBp: z
    .number()
    .int()
    .min(1000, "Weightage must be at least 10%")
    .max(10000, "Weightage cannot exceed 100%"),
  position: z.number().int().min(0).optional(),
});

export type GoalDraft = z.infer<typeof GoalDraftSchema>;

export const GoalSheetDraftSchema = z
  .object({
    sheetId: z.string().min(1),
    goals: z
      .array(GoalDraftSchema)
      .min(1, "Add at least one goal")
      .max(8, "Maximum of 8 goals per employee"),
  })
  .superRefine((val, ctx) => {
    // All goals — own + shared — must sum to exactly 100% (10000 bp).
    const total = val.goals.reduce((s, g) => s + g.weightageBp, 0);
    if (total !== 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total weightage must equal 100% (currently ${(total / 100).toFixed(1)}%)`,
        path: ["goals"],
      });
    }
    val.goals.forEach((g, i) => {
      if (g.uomType === "timeline" && !g.targetDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Timeline goals require a target date",
          path: ["goals", i, "targetDate"],
        });
      }
      if (
        (g.uomType === "min_num" || g.uomType === "min_pct" || g.uomType === "max_num" || g.uomType === "max_pct") &&
        (g.targetValue == null || isNaN(Number(g.targetValue)))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric goals require a target value",
          path: ["goals", i, "targetValue"],
        });
      }
    });
  });

export type GoalSheetDraft = z.infer<typeof GoalSheetDraftSchema>;

export const SubmitGoalSheetSchema = z.object({
  sheetId: z.string().min(1),
});

export const ApproveSheetSchema = z.object({
  sheetId: z.string().min(1),
  comment: z.string().max(500).optional(),
});

export const ReturnSheetSchema = z.object({
  sheetId: z.string().min(1),
  comment: z.string().min(3, "Please leave a note for the employee").max(500),
});

export const UnlockSheetSchema = z.object({
  sheetId: z.string().min(1),
  reason: z.string().min(3, "Reason is required for audit").max(500),
});

export const CheckInSchema = z.object({
  goalId: z.string().min(1),
  period: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  status: GoalStatusEnum,
  actualValue: z.number().nullable().optional(),
  completionDate: z.string().nullable().optional().or(z.literal("")),
  employeeNote: z.string().max(1200).optional().or(z.literal("")),
});

export const ManagerCheckInAckSchema = z.object({
  checkInId: z.string().min(1),
  comment: z.string().min(1, "Add a check-in comment").max(1200),
});

export const PushSharedGoalSchema = z.object({
  primaryGoalId: z.string().min(1),
  recipientUserIds: z.array(z.string().min(1)).min(1, "Pick at least one recipient"),
  note: z.string().max(500).optional().or(z.literal("")),
});
