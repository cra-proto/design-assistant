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

//Page metadata
export interface PageMeta {
  title?: string; // English Metadata title
  description?: string; // English Metadata description
  keywords?: string; // English Metadata keywords
  titleFR?: string; // French Metadata title
  descriptionFR?: string; // French Metadata description
  keywordsFR?: string; // French Metadata keywords
  template?: PageTemplate; // Determined based on page content & url pattern
  task?: string[]; // Determined by comparing with task airtable data
  visits?: number; // Determined by comparing with UPD data
  wordCount: number; // Count of words on page
  oppUrl?: string; // Opposite language URL
  oppTitle?: string; // Opposite language H1
  oppSectionTitle?: string; // Opposite language double H1
  owner?: string; // jrc:content.json gcContributor
  email?: string; // jrc:content.json gcBranch
  lastPublished?: Date; // jrc:content.json gcLastPublished
  lastModified?: Date; // jrc:content.json cq:lastModified
  noindexEN?: boolean;
  noindexFR?: boolean;
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

//Page status
export interface PageStatus {
  inScope: boolean; // True for user-added pages, False for discovered parent pages (user can also toggle this status)
  isOrphan: boolean; // True if parent doesn't link to the page
  isCrawled: boolean; // True after crawling for children
  isNew: boolean; // True if url is 404
  isMoved: boolean; // True if current parent doesn't match baseline parent
  isROT: boolean; // True if user flags page as ROT (redundant, outdated, trivial)
  linksToPortal: boolean; // True if page links to a portal
  noindexEN: boolean | 'to-reindex' | 'to-deindex'; // True if English page is not indexed for search
  noindexFR: boolean | 'to-reindex' | 'to-deindex'; // True if French page is not indexed for search
  archiveStatus: 'current' | 'archived' | 'to-archive' | 'unarchive'; // current/archived is set during add pages step, user can toggle to-archive
  isContainer: boolean; // True if page is a container page (used to group together pages for AI combine/split actions)
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

export interface OldNotes {
  problem: string;
  solution: string;
}

// Old project data interface
export interface ProjectTreeNodeData {
  h1: string;
  doubleH1: string;
  url: string;
  originalParent: string;
  status: PageStatus;
  metadata?: PageMeta;
  metadataReview?: MetadataReview; // AI generated metadata workflow
  problem?: PageProblem;
  notes?: OldNotes;
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

export interface FlattenedTreeNode {
  //English
  enH1: string;
  enDoubleH1: string;
  enPath: string;
  enVanity: string[];
  //French
  frH1: string;
  frDoubleH1: string;
  frPath: string;
  frVanity: string[];
  //Status
  inScope: boolean;
  isNew: boolean;
  isMoved: boolean;
  isROT: boolean;
  isArchived: boolean;
  noindex: boolean;
  //Actions
  actions: TreeNodeAction[];
  //Problems
  isOrphan: boolean;
  //Notes
  issue: string;
  solution: string;
  //Data
  template: string;
  linksToPortal: boolean;
  hasChatbot: boolean;
  task: string[];
  visits: number | undefined;
  updLink: string | undefined;
  lastModified: Date | undefined;
  lastPublished: Date | undefined;
  fleschKincaid: number | undefined;
  gunningFog: number | undefined;
  wordCount: number | undefined;
  linkCount: number | undefined;
  phoneNumbers: string[] | undefined;
  //Owner
  owner: string;
  email: string;
  //Metadata (prototype)
  titleEN: string;
  titleFR: string;
  descriptionEN: string;
  descriptionFR: string;
  keywordsEN: string;
  keywordsFR: string;
  //AI generated metadata
  aiDescriptionEN: MetadataField | undefined;
  aiKeywordsEN: MetadataField | undefined;
  aiDescriptionFR: MetadataField | undefined;
  aiKeywordsFR: MetadataField | undefined;
  aiGeneratedAt: Date | undefined;
  aiModel: string | undefined;
}

export const FIELD_FILTERS = ['isNew', 'isMoved', 'isROT', 'linksToPortal', 'archiveStatus', 'noindex', 'isOrphan'] as const;
export const COLUMN_GROUPS = ['english', 'french', 'status', 'actions', 'notes', 'problems', 'pageData', 'owner', 'metadata'] as const;
export type ColumnGroups = (typeof COLUMN_GROUPS)[number];

export interface TableColumn {
  field: keyof FlattenedTreeNode;
  label: string;
  type: 'text' | 'longText' | 'textArea' | 'array' | 'tags' | 'url' | 'boolean' | 'number' | 'archive' | 'noindex' | 'date' | 'aiText' | 'upd' | 'template';
  frozen?: boolean;
  group: ColumnGroups;
  visibleByDefault: boolean;
  dataSection: string[]; //reference to how the data is nested in the TreeNode, only need to fill out for user-editable data
}

export interface TreeNodeAction {
  key: string; // translation key, e.g. 'actions.newPage.createLive'
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

export interface ColumnGroup {
  key: string;
  translationKey: string;
  columns: TableColumn[];
  visible: boolean;
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
}

export const ALL_SOURCES = ['live', 'preview', 'protoGH', 'baseGH', 'protoUT', 'baseUT'] as const;
export type SourceVersion = (typeof ALL_SOURCES)[number];
export type UrlVersion = SourceVersion | 'upd';
export type CompareVersion = SourceVersion | 'ai';
