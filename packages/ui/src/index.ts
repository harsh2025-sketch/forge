/**
 * @forge/ui — public surface (V3 §3.2, §10).
 *
 * Exports: primitive components, composite components, layout shells, chart
 * containers and the ThemeTokens / CSS-variable application system.
 */

// Theme system
export type { ThemeTokens } from "./theme/types.js";
export { defaultTheme, contrastingTheme } from "./theme/defaults.js";
export {
  cssVariableName,
  flattenThemeTokens,
  resolveBorderRadius,
  resolveBorderWidth,
  resolveBorderStyle,
  resolveCardShadow,
  resolveComponentRadius,
  resolveDensityRow,
  resolveFontSize,
  resolveShadow,
  resolveSidebarWidth,
  resolveSpacingUnit,
  themeToCss,
  themeToCssVariables,
  tokenVar,
} from "./theme/apply.js";
export type { ThemeScopeProps } from "./theme/scope.js";
export { ThemeScope } from "./theme/scope.js";

// Primitives
export { Button } from "./primitives/button.js";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./primitives/button.js";
export { Input } from "./primitives/input.js";
export type { InputProps } from "./primitives/input.js";
export { Card } from "./primitives/card.js";
export type { CardProps, CardVariant } from "./primitives/card.js";
export { Dialog } from "./primitives/dialog.js";
export type { DialogProps } from "./primitives/dialog.js";
export { Select } from "./primitives/select.js";
export type { SelectOption, SelectProps } from "./primitives/select.js";
export { Tabs } from "./primitives/tabs.js";
export type { TabItem, TabsProps } from "./primitives/tabs.js";
export { Table } from "./primitives/table.js";
export type { TableColumn, TableProps, TableVariant } from "./primitives/table.js";
export { Badge } from "./primitives/badge.js";
export type { BadgeProps, BadgeTone } from "./primitives/badge.js";
export { Checkbox } from "./primitives/checkbox.js";
export type { CheckboxProps } from "./primitives/checkbox.js";
export { Toggle } from "./primitives/toggle.js";
export type { ToggleProps } from "./primitives/toggle.js";
export { CTA, FeatureList, Hero, PricingTable, Testimonials } from "./primitives/landing.js";
export type {
  CTAProps,
  Feature,
  FeatureListProps,
  HeroProps,
  PricingTableProps,
  PricingTier,
  Testimonial,
  TestimonialsProps,
} from "./primitives/landing.js";

// Composites
export { DataTable } from "./composites/data-table.js";
export type { DataTableProps } from "./composites/data-table.js";
export { FormField } from "./composites/form-field.js";
export type { FormFieldProps } from "./composites/form-field.js";
export { StatusBadge } from "./composites/status-badge.js";
export type { StatusBadgeProps } from "./composites/status-badge.js";
export { SeverityBadge } from "./composites/severity-badge.js";
export type { SeverityBadgeProps } from "./composites/severity-badge.js";
export { EmptyState } from "./composites/empty-state.js";
export type { EmptyStateProps } from "./composites/empty-state.js";
export { ErrorState } from "./composites/error-state.js";
export type { ErrorStateProps } from "./composites/error-state.js";
export { LoadingState } from "./composites/loading-state.js";
export type { LoadingStateProps } from "./composites/loading-state.js";
export { Notice } from "./composites/notice.js";
export type { NoticeProps, NoticeTone } from "./composites/notice.js";
export { Pagination } from "./composites/pagination.js";
export type { PaginationProps } from "./composites/pagination.js";

// Layout shells
export { Shell } from "./layouts/shell.js";
export type { ShellProps } from "./layouts/shell.js";
export { Sidebar } from "./layouts/sidebar.js";
export type { SidebarItem, SidebarProps } from "./layouts/sidebar.js";
export { TopNav } from "./layouts/top-nav.js";
export type { TopNavProps } from "./layouts/top-nav.js";

// Chart containers
export { ChartContainer } from "./charts/chart-container.js";
export type { ChartContainerProps } from "./charts/chart-container.js";

// Shared internal helper (public for convenience)
export { cn } from "./classnames.js";
