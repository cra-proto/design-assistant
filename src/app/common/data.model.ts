/*
HOW TO UPDATE THIS FILE: 
Any data specific to the project will be stored in the Project interface
Any data specific to a page will be stored in the TreeNode 'data' property as a PageMeta or PageProblem or PageXXX array
Don't store values that can be derived from other values unless you need to display it on the saved project screen (e.g., page count)
*/

import { TreeNode } from "primeng/api";

//Saved local projects
export interface LocalProject {
    key: string;
    timestamp: number;
    pages: number;
    phase: ProjectPhase;
    local: boolean;
    repo?: string;
}

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
    bio: string | null;
}

export interface GitHubRepo {
    owner: string;
    repo: string;
    branch: string;
    hasBaselineRepo: boolean;
}

//Page metadata
export interface PageMeta {
    url: string;                    // User-added URL
    oppUrl: string;                 // Oppostie language URL    
    baselineParent: string | null;  // Last url in breadcrumb (the parent page)
    h1: string;                     // All H1's on the page
    title?: string;                 // Metadata title
    description?: string;           // Metadata description
    keywords?: string;              // Metadata keywords
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
    h1: string;
    url: string;
    oppUrl: string;
    inScope: boolean;
    isOrphan: boolean;
    isNew: boolean;
    isMoved: boolean;
    isROT: boolean;
}

export interface TableColumn {
    field: keyof FlattenedTreeNode;
    translationKey: string;
    type: 'text' | 'url' | 'boolean';
    frozen?: boolean;
}

//Project interface
export interface Project {
    //Project metadata
    id: string;
    version: number;
    projectName: string;
    phase: ProjectPhase;
    created: Date;
    lastModified: Date;
    lastSaved: Date;
    lastExported: Date;
    storageLocation: 'browser' | 'cloud';
    collaborators?: GitHubUser[];
    baselinePages: number;
    inScopePages: number;
    //GitHub repo data
    github: GitHubRepo;
    //Project data
    projectData: TreeNode[];
}