/*TO-DO
Project interface (name, phase, last modified, collaborators etc.)
TreeNode interface (all data)
PageMeta interface (used in data section of TreeNode)
PagePromlem interface (used in data section of TreeNode)
Enum for ProjectPhase & status (draft, discover, assess, completed, in progress, pending)
*/

import { TreeNode } from "primeng/api";

//Project phase
export enum ProjectPhase {
    Discover = 'phase.discover',
    Assess = 'phase.assess',
    Design = 'phase.design',
    Approve = 'phase.approve',
}

export type PhaseStatus = 'status.complete' | 'status.current' | 'status.pending';

export interface PhaseDisplay {
    phase: ProjectPhase;
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
    githubOwner: string;
    githubRepo: number;
    githubBranch: string;
    baselineRepo: boolean;
}

//Page metadata
export interface PageMetadata {
    title?: string;
    description?: string;
    keywords?: string[];
    owner?: string;
    email?: string;
    lastModified?: Date;
}

//Page problems
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

//Project interface
export interface Project {
    //Project metadata
    id: string;
    projectName: string;
    phase: ProjectPhase;
    created: Date;
    lastModified: Date;
    storageLocation: 'local' | 'cloud';
    collaborators?: GitHubUser[];
    //GitHub repo data
    githubRepo: GitHubRepo;
    //Project data
    projectData: TreeNode[];
}