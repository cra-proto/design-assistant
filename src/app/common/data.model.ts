/*
HOW TO UPDATE THIS FILE: 
Any data specific to the project will be stored in the Project interface
Any data specific to a page will be stored in the TreeNode 'data' property as a PageMeta or PageProblem or PageXXX array
Don't store values that can be derived from other values unless you need to display it on the saved project screen (e.g., page count)
*/

import { TreeNode } from "primeng/api";

//Project phase
export enum ProjectPhase {
    Draft = 'project.phase.draft',
    Discover = 'project.phase.discover',
    Assess = 'project.phase.assess',
    Design = 'project.phase.design',
    Approve = 'project.phase.approve',
    Complete = 'project.phase.complete'
}

export enum PhaseStatus {
    Complete = 'project.phase.status.complete',
    Current = 'project.phase.status.current',
    Pending = 'project.phase.status.pending'
}

export interface CurrentPhase {
    name: ProjectPhase;
    status: PhaseStatus;
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
    title?: string;                 // English Metadata title
    description?: string;           // English Metadata description
    keywords?: string;              // English Metadata keywords
    titleFR?: string;               // French Metadata title
    descriptionFR?: string;         // French Metadata description
    keywordsFR?: string;            // French Metadata keywords
    template?: string;              // Determined based on page content & url pattern
    task?: string[];                // Determined by comparing with task airtable data
    visits?: number;                // Determined by comparing with UPD data
    wordCount: number;              // Count of words on page
    oppUrl?: string;                // Opposite language URL 
    oppTitle?: string;              // jrc:content.json otherTitle
    owner?: string;                 // jrc:content.json gcContributor
    email?: string;                 // jrc:content.json gcBranch
    lastPublished?: Date;           // jrc:content.json gcLastPublished
    lastModified?: Date;            // jrc:content.json cq:lastModified
    noindexEN?: boolean;
    noindexFR?: boolean;
}

//AI metadata generation workflow
export type MetadataReviewStatus = 'pending' | 'approved' | 'edited' | 'rejected';

export interface MetadataField {
    ai: string;           // What the AI suggested
    edited?: string;      // What the user changed it to (only set if different from ai)
    status: MetadataReviewStatus;
}

export interface MetadataReview {
    generatedAt: Date;
    model: string;       // Which model generated it (from OpenRouterResponse.model)
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
    inScope: boolean;                // True for user-added pages, False for discovered parent pages (user can also toggle this status)
    isOrphan: boolean;               // True if parent doesn't link to the page
    isCrawled: boolean;              // True after crawling for children
    isNew: boolean;                  // True if url is 404
    isMoved: boolean;                // True if current parent doesn't match baseline parent
    isROT: boolean;                  // True if user flags page as ROT (redundant, outdated, trivial)
    linksToPortal: boolean;          // True if page links to a portal
    noindexEN: boolean;              // True if English page is not indexed for search
    noindexFR: boolean;              // True if French page is not indexed for search
    archiveStatus: 'current' | 'archived' | 'to-archive' | 'unarchive' // current/archived is set during add pages step, user can toggle to-archive
    isContainer: boolean;            // True if page is a container page (used to group together pages for AI combine/split actions)
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

export interface ProjectTreeNodeData {
    h1: string;
    doubleH1: string;
    url: string;
    originalParent: string;
    status: PageStatus;
    metadata?: PageMeta;
    metadataReview?: MetadataReview;   // AI generated metadata workflow
    problem?: PageProblem
}

export interface FlattenedTreeNode {
    //Current language
    h1: string;
    doubleH1: string;
    url: string;
    //Opposite language
    oppTitle: string;
    oppUrl: string;
    //GitHub
    prototypeUrl: string;
    //Status
    inScope: boolean;
    isOrphan: boolean;
    isNew: boolean;
    isMoved: boolean;
    isROT: boolean;
    linksToPortal: boolean;
    noindex: 'both' | 'en-only' | 'fr-only' | 'none';
    archiveStatus: 'current' | 'archived' | 'to-archive' | 'unarchive'
    //Data
    template: string;
    task: string[];
    visits: number | undefined;
    lastModified: Date | undefined;
    lastPublished: Date | undefined;
    wordCount: number | undefined;
    //Metadata
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
    //Owner
    owner: string;
    email: string;
}

export interface TableColumn {
    field: keyof FlattenedTreeNode;
    translationKey: string;
    type: 'text' | 'longText' | 'array' | 'url' | 'boolean' | 'number' | 'archive' | 'noindex' | 'date' | 'aiText';
    frozen?: boolean;
    group: 'page' | 'oppPage' | 'github' | 'status' | 'owner' | 'pageData' | 'metadata';
    visibleByDefault: boolean;
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
    baselinePages: number;
    projectData: TreeNode[];  // Full tree structure
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
}