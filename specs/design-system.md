# Design System — AtomicPulse

## North Star
Premium, calm, dense-when-needed. Microsoft enterprise trust meets Linear's keyboard-first speed meets Arc's softness. The UI should feel like *thinking out loud* — fluid, optimistic, AI-aware.

## Tokens (Tailwind v4 CSS variables)

```css
@layer base {
  :root {
    /* surfaces */
    --surface-0: 0 0% 100%;        /* page background (light) */
    --surface-1: 220 16% 98%;
    --surface-2: 220 13% 95%;
    --surface-3: 220 13% 91%;
    --border-subtle: 220 13% 91%;
    --border-strong: 220 9% 80%;

    /* text */
    --fg-primary: 222 47% 11%;
    --fg-secondary: 215 14% 34%;
    --fg-muted: 217 11% 53%;

    /* accents */
    --accent: 221 83% 53%;          /* MS-leaning blue */
    --accent-soft: 221 95% 96%;
    --ai-from: 263 90% 65%;          /* AI gradient start */
    --ai-to: 192 95% 60%;            /* AI gradient end */

    /* state */
    --success: 142 71% 45%;
    --warn: 38 92% 50%;
    --danger: 0 84% 60%;

    /* effects */
    --ring: 221 83% 53%;
    --shadow-card: 0 1px 2px rgb(15 23 42 / 6%), 0 8px 24px -12px rgb(15 23 42 / 12%);
    --radius: 0.625rem;
  }

  .dark {
    --surface-0: 222 47% 6%;
    --surface-1: 222 33% 9%;
    --surface-2: 222 27% 12%;
    --surface-3: 222 22% 16%;
    --border-subtle: 222 22% 18%;
    --border-strong: 222 14% 28%;
    --fg-primary: 210 40% 98%;
    --fg-secondary: 215 20% 75%;
    --fg-muted: 217 11% 60%;
    --accent: 217 91% 70%;
    --accent-soft: 222 47% 15%;
  }

  .hc {
    /* high-contrast enterprise; near-black bg + AAA text contrast */
    --surface-0: 0 0% 0%;
    --surface-1: 0 0% 6%;
    --surface-2: 0 0% 10%;
    --surface-3: 0 0% 14%;
    --fg-primary: 0 0% 100%;
    --fg-secondary: 0 0% 92%;
    --accent: 50 100% 60%;
  }
}
```

## Typography
- Display + UI: `Geist` (Vercel) — system-grade neutrality.
- Mono: `JetBrains Mono` — for IDs, weightages in tables.
- Tight tracking on numerals (`tabular-nums`) wherever weightages or scores show.

## Component primitives (shadcn/ui)
- Button, Input, Textarea, Select, Combobox, Dialog, Sheet, Drawer, Toast (sonner), Tooltip, Popover, Tabs, Card, Badge, Progress, Skeleton, Switch, Checkbox, RadioGroup, Slider, Calendar, DatePicker, Command (palette), DropdownMenu, ContextMenu, Avatar, ScrollArea, Separator, Table.

## Domain components (`components/`)
- `WeightageRing` — animated radial showing 100% allocation (red < 100, amber > 100, green = 100).
- `GoalRow` — drag handle, inline UoM picker, weightage stepper (mouse-wheel + keyboard), status pill.
- `UoMPicker` — segmented control (`Min` / `Max` / `Timeline` / `Zero`) with sub-toggle (`Numeric` / `%`).
- `ApprovalDrawer` — side sheet with diff view + comment box.
- `CheckInCanvas` — split planned vs actual with score gauge.
- `RiskBadge` — AI risk indicator with tooltip listing signals.
- `Heatmap`, `QoQTrend`, `ThrustAreaTreemap`, `ManagerEffectivenessGrid`.
- `CommandPalette` — `⌘K` global; supports navigation + AI quick actions (`>` mode).
- `CopilotPanel` — right-side sheet streaming responses; pinned per-route context.
- `ScoreGauge` — `0–100%` arc with smooth Framer transition.

## Layout
- Persistent sidebar (collapsible, icon-only collapsed width 56px, expanded 240px).
- Topbar (56px): logo, breadcrumb, global search, copilot, notifications, role badge, theme.
- Page max-width 1400px on dashboards; 1200px on forms.
- Sticky page header with title + key actions; sub-tabs hug top.

## Density
- Default density: comfortable.
- Compact toggle on dashboards/admin tables (Linear-style row height 32px).

## Motion language
- Page transitions: 180ms ease-out fade + 4px y-translate.
- Panel/drawer entries: spring(stiffness 320, damping 30).
- List reorders: `Reorder.Group` from Framer Motion.
- AI streaming: shimmer + token-fade-in per word.
- Reduced motion respected; all animations gated on `prefers-reduced-motion`.

## A11y rules
- Color is never the only signifier (status pills also have icons).
- Focus rings always visible via `--ring`.
- Min hit-target 36×36px.
- All async regions `aria-live="polite"`.
- Command palette has full keyboard nav + screen-reader announcements.

## Iconography
- `lucide-react` for general, `@radix-ui/react-icons` for primitives.
- Custom AI sparkle glyph for AI affordances.

## Empty states
Every list has a tasteful empty state with a single primary CTA — never a blank page.

## Toast etiquette
- Success: 2s, single line.
- Error: 6s, with retry CTA.
- AI: includes tokens used + model badge, on demand.
