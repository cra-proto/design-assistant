/*
HOW TO UPDATE THIS FILE: 
Add any constants or interfaces that are sunset from the main data.model if needed for patching old projects
After a bulk patch of existing projects, consider removing anything that is no longer needed
*/

import { MetadataField, MetadataReview, PageProblem, PageTemplate, TreeNodeAction } from './data.model';

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
  linksToSignIn: boolean;
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
export const GLOBAL_FIELDS = [
  'enH1',
  'enDoubleH1',
  'enPath',
  'enVanity',
  'frH1',
  'frDoubleH1',
  'frPath',
  'frVanity',
  'inScope',
  'isNew',
  'isMoved',
  'isROT',
  'isArchived',
  'noindex',
  'actions',
  'isOrphan',
  'issue',
  'solution',
  'template',
  'linksToPortal',
  'linksToSignIn',
  'hasChatbot',
  'task',
  'visits',
  'updLink',
  'lastModified',
  'lastPublished',
  'fleschKincaid',
  'gunningFog',
  'wordCount',
  'linkCount',
  'phoneNumbers',
  'owner',
  'email',
  'titleEN',
  'titleFR',
  'descriptionEN',
  'descriptionFR',
  'keywordsEN',
  'keywordsFR',
  'aiDescriptionEN',
  'aiKeywordsEN',
  'aiDescriptionFR',
  'aiKeywordsFR',
  'aiGeneratedAt',
  'aiModel',
] as const satisfies readonly (keyof FlattenedTreeNode)[];

export interface TableColumn {
  field: keyof FlattenedTreeNode;
  label: string;
  type: 'text' | 'longText' | 'textArea' | 'array' | 'tags' | 'url' | 'boolean' | 'number' | 'archive' | 'noindex' | 'date' | 'aiText' | 'upd' | 'template';
  frozen?: boolean;
  group: ColumnGroups;
  visibleByDefault: boolean;
  dataSection: string[]; //reference to how the data is nested in the TreeNode, only need to fill out for user-editable data
}
