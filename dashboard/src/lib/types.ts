export type { StatusColor } from "./status";

export interface DeliveryTask {
  [key: string]: unknown;
  id: string;
  name: string;
  status: string;
  assignees: string;
  dueDate: string | null;
  startDate: string | null;
  dateDone: number;
  timeEstimate: number;
  timeSpent: number;
  rate: number;
  budget: number;
  spentBudget: number;
  ohwBedrag: number;
  url: string;
  issues: string[];
  isContainer: boolean;
  parent: string | null;
  /** Uren geschreven op container-taak (hygiëne) */
  hoursOnContainer: number;
}

export interface OverviewItem {
  [key: string]: unknown;
  id: string;
  type: "project" | "estimate";
  name: string;
  status: string;
  client: string;
  pm: string;
  grippNr: string;
  grippId: string;
  url: string;

  signedOfferValue: number;
  vendorCosts: number;
  vendorMargin: number;
  riskBuffer: number;
  totalTaskBudget: number;

  plannedBudget: number;
  spentBudget: number;
  plannedHours: number;
  actualHours: number;

  planPct: number;
  burnPct: number;
  ohw: number;
  ohwFromTasks: number;
  ohwOverview: number;
  budgetLeft: number;
  marge: number;

  taskCount: number;
  hasList: boolean;
  listId: string | null;
  listUrl: string | null;
  /** Lijst is gearchiveerd in ClickUp */
  listArchived?: boolean;

  tasks: DeliveryTask[];
}

export interface ArchivedIssue {
  [key: string]: unknown;
  taskName: string;
  project: string;
  list: string;
  hours: number;
  url: string;
}

export interface CacheData {
  syncedAt: string;
  spaces: Record<string, string>;
  projects: OverviewItem[];
  estimates: OverviewItem[];
  archivedIssues: ArchivedIssue[];
  stats: {
    totalProjects: number;
    totalEstimates: number;
    projectsWithTasks: number;
    projectsWithOrderValue: number;
    totalTasks: number;
  };
}
