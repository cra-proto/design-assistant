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

//GitHub user info
export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    email: string | null;
    bio: string | null;
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
    githubOwner: string;
    githubRepo: string;
    githubBranch: string;
    baselineRepo: boolean;
    //Project data
    projectData: TreeNode[];
}