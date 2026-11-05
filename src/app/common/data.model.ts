/*
HOW TO UPDATE THIS FILE: 
Any data specific to the project will be stored in the Project interface
Any data specific to a page will be stored in the TreeNode 'data' property as a PageMeta or PageProblem or PageXXX array
Don't store values that can be derived from other values unless you need to display it on the saved project screen (e.g., page count)
*/

import { TreeNode } from 'primeng/api';

//Project phase
export enum ProjectPhase {
  Draft = 'project.phase.draft',
  Discover = 'project.phase.discover',
  Assess = 'project.phase.assess',
  Design = 'project.phase.design',
  Approve = 'project.phase.approve',
  Complete = 'project.phase.complete',
}

export enum PhaseStatus {
  Complete = 'project.phase.status.complete',
  Current = 'project.phase.status.current',
  Pending = 'project.phase.status.pending',
}

export interface CurrentPhase {
  name: ProjectPhase;
  status: PhaseStatus;
}

//Project version
export type DataVersion = 'live' | 'prototype' | 'baseline';

//Templates
export enum PageTemplate {
  Content = 'template.content',
  Subway = 'template.subway',
  OldSubway = 'template.oldSubway',
  Newsroom = 'template.newsroom',
  VideoTranscript = 'template.videoTranscript',
  Campaign = 'template.campaign',
  ReadmeForm = 'template.readmeForm',
  ReadmeGuide = 'template.readmeGuide',
  Guide = 'template.guide',
  GuideT1 = 'template.guideT1',
  ReadmeT1 = 'template.readmeT1',
  ReadmeTD1 = 'template.readmeTD1',
  ReadmePayroll = 'template.readmePayroll',
  Contact = 'template.contact',
  Topic = 'template.topic',
  OldTopic = 'template.oldTopic',
  Navigation = 'template.navigation',
  Brochure = 'template.brochure',
  PdfDownload = 'template.pdfDownload',
  MultimediaGallery = 'template.multimediaGallery',
  Taxtip = 'template.taxtip',
  TaxFilingSeasonMediaKit = 'template.taxFilingSeasonMediaKit',
  EnforcementNotice = 'template.enforcementNotice',
  Freestyle = 'template.freestyle',
}

//GitHub
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  branch: string;
  hasBaselineRepo: boolean;
}

//AI metadata generation workflow
export type MetadataReviewStatus = 'pending' | 'edited' | 'noChange' | 'rejected' | 'approvedAI' | 'approvedEdits';

export interface MetadataField {
  ai: string; // What the AI suggested
  edited?: string; // What the user changed it to (only set if different from ai)
  status: MetadataReviewStatus;
}

export interface MetadataReview {
  generatedAt: Date;
  model: string; // Which model generated it (from OpenRouterResponse.model)
  en: {
    description: MetadataField;
    keywords: MetadataField;
  };
  fr: {
    description: MetadataField;
    keywords: MetadataField;
  };
}

//Page problems (placeholder!)
export interface PageProblem {
  type: 'broken-link' | 'invalid-link-text' | 'missing-alt' | 'accessibility' | 'other';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string; // where in the page
  foundAt: Date;
  // For broken links specifically:
  linkUrl?: string;
  linkText?: string;
}

//Page notes
export interface PageNotes {
  issue: string;
  solution: string;
}

export interface AlertIssueData {
  translationId?: string;
  alertIndex?: number;
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  include: boolean;
}

export interface AlertIssueTranslationData {
  translationId: string;
  description: string;
  recommendation: string;
}

export interface AlertIssuesTranslationData {
  translatedAt: string;
  model?: string;
  issues: AlertIssueTranslationData[];
}

export interface AlertIssuesReport {
  analyzedHtmlHash: string;
  analyzedAt: string;
  model?: string;
  issues: AlertIssueData[];
  translations?: {
    fr?: AlertIssuesTranslationData;
  };
}

// All types used by TreeNodeData
export type TreeNodeTypes = string | number | boolean | string[] | PageTemplate | PageProblem | undefined;

// New project tree data interface
export interface TreeNodeData {
  lang: 'en' | 'fr';
  path: {
    en: string;
    fr: string;
  };
  //Other data sources (airtable, UPD, vanity list)
  task?: {
    en: string[];
    fr: string[];
  };
  visits?: {
    en: number;
    fr: number;
  };
  vanity?: {
    en: string[];
    fr: string[];
  };
  //Status requiring action
  status: PageActions;
  // Version-specific data
  live?: {
    en: LangData;
    fr: LangData;
  };
  baseline?: {
    en: LangData;
    fr: LangData;
  };
  prototype?: {
    en: LangData;
    fr: LangData;
  };
  // AI generated metadata workflow
  metadataReview?: MetadataReview;
  // User notes
  notes?: PageNotes;
  // Persisted issue-analysis reports
  issueReports?: {
    en?: { alerts?: AlertIssuesReport };
    fr?: { alerts?: AlertIssuesReport };
  };
  // Approval tracking
  approved?: ApprovalData;
  //Hidden tracking info
  isContainer: boolean; // True if page is a container page (used to group together pages for AI combine/split actions)
  isCrawled: boolean; // True after crawling for children
  isNavChild?: boolean; // True for duplicate nodes created to reveal navigational children in IA diagram
}

// New page status interface
export interface PageActions {
  inScope: boolean; // True for user-added pages or toggled by user
  isNew: boolean; // True if baseline is 404
  isMoved: boolean; // True if prototype or live originalParent doesn't match baseline originalParent
  isROT: boolean; // True if user flags page as ROT (redundant, outdated, trivial)
}

// New lang data interface
export interface LangData {
  h1: string;
  doubleH1?: string;
  //Content
  contentHash?: string; // Hash of normalized page HTML at last crawl
  lastChecked?: string; // ISO string of fetch date
  githubSha?: string; // SHA of last GitHub export
  localSha?: string; // SHA-256 of last local export
  //Metadata
  title: string; // metadata title
  description: string; // metadata description
  keywords: string; // metadata keywords
  //Status
  is404: boolean; // True if page is 404 (helps determine completion of NEW/ROT actions)
  isOrphan: boolean; // True if parent doesn't link to the page
  noindex: boolean; // True if page is not indexed for search
  isArchived: boolean; // True if page has archive banner
  linksToPortal: boolean; // True if page links to a portal
  linksToSignIn: boolean; // True if page links to a sign-in page
  hasChatbot: boolean; // True if page has chatbot
  // jrc:content.json
  owner?: string; // gcContributor
  email?: string; // gcBranch
  lastPublished?: string; // gcLastPublished
  lastModified?: string; // cq:lastModified
  //Data
  parentPath?: string; // For page move detection
  wordCount: number; // Count of words on page
  linkCount: number; // Count of links on page
  fleschKincaid: number; // Calculated reading grade level
  gunningFog: number; // Calculated reading grade level
  template: PageTemplate; // Determined based on page content & url pattern
  phoneNumbers: string[];
  // Data from problem assistant
  problem?: PageProblem;
}

export interface ApprovalData {
  metadata?: string; //stores a hash of the 6 approved metadata values so state can be cleared if edits are made
}

export interface TreeNodeAction {
  key: string; // translation key, e.g. 'actions.newPage.createLive'
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

//Project interface
export interface Project extends ProjectMetadata {
  version: string;
  created: Date;
  lastSaved: Date;
  lastExported: Date | null;
  lastDownloaded: Date | null;
  baselinePages: number;
  projectData: TreeNode[]; // Full tree structure
}

// Project metadata for displaying in project lists (both local and cloud)
export interface ProjectMetadata {
  id: string;
  key: string;
  projectName: string;
  lastModified: Date;
  phase: ProjectPhase;
  inScopePages: number;
  collaborators: GitHubUser[];
  github: GitHubRepo;
  storageType: 'local' | 'cloud';
  repoType: 'local' | 'github';
  org?: string;
  lockedBy?: string;
}

export const ALL_SOURCES = ['live', 'preview', 'protoGH', 'baseGH', 'protoUT', 'baseUT'] as const;
export type SourceVersion = (typeof ALL_SOURCES)[number];
export type UrlVersion = SourceVersion | 'upd' | 'aida';
