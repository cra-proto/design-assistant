/*
HOW TO UPDATE THIS FILE: 
Any data specific to the project will be stored in the Project interface
Any data specific to a page will be stored in the TreeNode 'data' property as a PageMeta or PageProblem or PageXXX array
Don't store values that can be derived from other values unless you need to display it on the saved project screen (e.g., page count)
*/

import { TreeNode } from "primeng/api";

//Project phase
export enum ProjectPhase {
    Draft = 'phase.draft',
    Discover = 'phase.discover',
    Assess = 'phase.assess',
    Design = 'phase.design',
    Approve = 'phase.approve',
    Complete = 'phase.complete'
}

export type PhaseStatus = 'status.complete' | 'status.current' | 'status.pending';

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
    title?: string;                 // Metadata title
    description?: string;           // Metadata description
    keywords?: string;              // Metadata keywords
    template?: string;              // Determined based on page content & url pattern
    task?: string[];                  // Determined by comparing with task airtable data
    visits?: number;                // Determined by comparing with UPD data
    oppUrl?: string;                // Opposite language URL 
    oppTitle?: string;              // jrc:content.json otherTitle
    owner?: string;                 // jrc:content.json gcContributor
    email?: string;                 // jrc:content.json gcBranch
    lastPublished?: Date;           // jrc:content.json gcLastPublished
    lastModified?: Date;            // jrc:content.json cq:lastModified
}

//Page status
export interface PageStatus {
    inScope: boolean;                // True for user-added pages, False for discovered parent pages (user can also toggle this status)
    isOrphan: boolean;               // True if parent doesn't link to the page
    isCrawled: boolean;              // True after crawling for children
    isNew: boolean;                  // True if url is 404
    isMoved: boolean;                // True if current parent doesn't match baseline parent
    isROT: boolean;                  // True if user flags page as ROT (redundant, outdated, trivial)
    archiveStatus: 'current' | 'archived' | 'to-archive' // current/archived is set during add pages step, user can toggle to-archive
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
    url: string;
    originalParent: string;
    status: PageStatus;
    metadata?: PageMeta;
    problem?: PageProblem
}

export interface FlattenedTreeNode {
    //Current language
    h1: string;
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
    archiveStatus: 'current' | 'archived' | 'to-archive'
    //Data
    template: string;
    task: string[];
    visits: number | undefined;
    //Metadata
    title: string;
    description: string;
    keywords: string;
    //Owner
    owner: string;
    email: string;
}

export interface TableColumn {
    field: keyof FlattenedTreeNode;
    translationKey: string;
    type: 'text' | 'longText' | 'array' | 'url' | 'boolean' | 'number' | 'archive';
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
    lastExported: Date;
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