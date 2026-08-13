import { Component, ChangeDetectionStrategy, inject, computed, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from "@ngx-translate/core";

import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { IftaLabelModule } from 'primeng/iftalabel';
import { KeyFilterModule } from 'primeng/keyfilter';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

import { CollaboratorService } from '../../services/github/collaborator.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { GitHubUser } from '../../common/data.model';

export type CollaboratorMode = 'list' | 'dashboard' | 'switch';

/**
 * Reviewed: 2026-08-13 (ng21)
 * 
 * Handles adding, removing, and displaying GitHub collaborators in a list or as a group.
 */
@Component({
    selector: 'aida-add-collaborators',
    imports: [CommonModule, FormsModule, TranslatePipe,
        AvatarModule, AvatarGroupModule, TooltipModule, ButtonModule, ConfirmDialogModule,
        DialogModule, MessageModule,
        AutoCompleteModule, IftaLabelModule, KeyFilterModule
    ],
    templateUrl: './add-collaborators.component.html',
    styles: ``,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCollaboratorsComponent implements OnInit {
    private readonly translate = inject(TranslateService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly projectState = inject(ProjectStateService);
    protected readonly collaboratorService = inject(CollaboratorService);
    protected readonly exportGitHubService = inject(ExportGitHubService);

    /** Display modes: list, dashboard, or switch */
    public readonly mode = input<CollaboratorMode>('list');
    /** Only used to display collaborators for non-active projects, leave undefined for the active project */
    public readonly collabs = input<GitHubUser[] | null>(null);

    protected readonly maxVisibleCollaborators = 5;

    protected readonly projectData = this.projectState.getProject;
    protected readonly collaborators = computed(() => this.collabs() ?? this.projectData().collaborators);

    /**  Remove collaborator (with confirmation for removing self) */
    protected removeCollaborator(collab: GitHubUser) {
        const currentUser = this.exportGitHubService.user();
        if (currentUser && collab.id === currentUser.id) {
            this.confirmationService.confirm({
                key: 'collab',
                icon: 'pi pi-exclamation-triangle',
                header: this.translate.instant('collaborators.confirm.removeSelf.header'),
                message: this.translate.instant('collaborators.confirm.removeSelf.message'),
                acceptButtonProps: {
                    label: this.translate.instant('collaborators.confirm.removeSelf.accept'),
                    severity: 'danger'
                },
                rejectButtonProps: {
                    label: this.translate.instant('common.cancel'),
                    severity: 'secondary',
                    outlined: true
                },
                accept: () => {
                    this.removeUser(collab);
                    console.warn("You removed yourself from the project. You will no longer be able to save changes to the cloud.");
                }
            });
        } else {
            this.removeUser(collab);
        }
    }
    private removeUser(collab: GitHubUser) {
        const updatedProject = this.collaboratorService.removeCollaborator(this.projectData(), collab);
        this.projectState.setProject(updatedProject);
    }

    // Variables for autocomplete dropdown
    private readonly orgMembers = signal<GitHubUser[]>([]);
    protected selectedCollaborators: GitHubUser[] | [] = [];
    protected readonly filteredCollaborators = signal<GitHubUser[]>([])
    protected readonly collabFilter = /^[a-zA-Z0-9-]*$/;

    // Initialize dropdown with org members
    async ngOnInit() {
        const owner = this.projectData().github.owner;
        if (owner) {
            this.orgMembers.set(await this.collaboratorService.getOrgMembers(owner));
            this.filteredCollaborators.set([...this.orgMembers()]);
        }
    }

    /** Filter collaborators:
     ** show all if empty
     ** otherwise filter by startsWith and then includes
     ** otherwise try to fetch user
     *
     * Note: existing collaborators are not filtered out. This form can be used to update their user info.
     */
    protected async filterCollaborators(event: AutoCompleteCompleteEvent) {
        const query = event.query?.trim().toLowerCase().replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').substring(0, 39) || '';

        // If query is empty, return all org members
        if (query.length === 0) {
            this.filteredCollaborators.set(this.orgMembers());
            return;
        }

        // Filter existing org members
        const startsWith = this.orgMembers().filter(user =>
            user.login.toLowerCase().startsWith(query)
        );
        const includes = this.orgMembers().filter(user =>
            user.login.toLowerCase().includes(query) &&
            !user.login.toLowerCase().startsWith(query)
        );
        this.filteredCollaborators.set(Array.from(new Set([...startsWith, ...includes])));

        // If no matches found, try to fetch the typed username as a GitHub user
        if (this.filteredCollaborators().length === 0) {
            const userDetails = await this.collaboratorService.getUserDetails(query);
            if (userDetails) {
                this.filteredCollaborators.set([userDetails]);
            }
        }
    }

    /**  Find and update user details when a collaborator is selected (name and email will be missing initially)*/
    protected async onCollabSelect(event: AutoCompleteSelectEvent) {
        const selected = event.value as GitHubUser;
        if (!selected.name && !selected.email) {
            const details = await this.collaboratorService.getUserDetails(selected.login);
            if (details) {
                //console.log('Fetched details for selected user:', details);
                const index = this.selectedCollaborators.findIndex(c => c.id === selected.id);
                if (index !== -1) {
                    this.selectedCollaborators[index] = details;
                }
            }
        }
    }

    /** Reset the filter */
    protected onDropdownClick() {
        this.filteredCollaborators.set([...this.orgMembers()]);
    }

    /** Add selected collaborators to project */
    protected readonly addSelectedCollaborators = () => {
        if (this.selectedCollaborators.length === 0) return;
        const updatedProject = this.collaboratorService.addCollaborators(this.projectData(), this.selectedCollaborators);
        this.projectState.setProject(updatedProject);
        this.selectedCollaborators = [];
    }

    // For share button (group mode)
    protected showShareDialog = false;
    protected openShareDialog() {
        this.showShareDialog = true;
    }
    protected readonly closeShareDialog = () => {
        this.showShareDialog = false;
        this.selectedCollaborators = []; // Reset on close
    }

    /** Add selected collaborators to project and close the share dialog */
    protected readonly addAndCloseShareDialog = () => {
        this.addSelectedCollaborators();
        this.closeShareDialog();
    }

    /** Format request access email (returns an empty string if no emails available for existing collaborators) */
    protected getRequestAccessMailto(): string {
        const emails = this.collaboratorService.getCollaboratorEmails(this.collaborators())
        if (emails.length === 0) return '';
        const name = this.projectData().projectName;
        const user = this.exportGitHubService.user();

        const subject = this.translate.instant('collaborators.email.requestAccess.subject', { name });
        const bodyEn = this.translate.instant('collaborators.email.requestAccess.bodyEN', { user, name });
        const bodyFr = this.translate.instant('collaborators.email.requestAccess.bodyFR', { user, name });
        const body = `${bodyEn}\n\n\n\n${bodyFr}`;

        return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    /** Open preformated mailto in users registered mail client */
    protected openMailto(mailto: string): void {
        window.open(mailto, '_self');
    }

}