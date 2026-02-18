import { Component, inject, computed, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { marker } from '@colsen1991/ngx-translate-extract-marker';

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

import { CollaboratorService } from '../../services/collaborator.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { GitHubUser } from '../../common/data.model';


export type CollaboratorMode = 'list' | 'dashboard' | 'switch';

@Component({
    selector: 'aida-add-collaborators',
    imports: [CommonModule, FormsModule, TranslateModule,
        AvatarModule, AvatarGroupModule, TooltipModule, ButtonModule, ConfirmDialogModule,
        DialogModule, MessageModule,
        AutoCompleteModule, IftaLabelModule, KeyFilterModule
    ],
    templateUrl: './add-collaborators.component.html',
    styles: ``
})
export class AddCollaboratorsComponent implements OnInit {
    private translate = inject(TranslateService);
    private confirmationService = inject(ConfirmationService);
    collaboratorService = inject(CollaboratorService);
    projectState = inject(ProjectStateService);
    exportGithub = inject(ExportGitHubService);

    @Input() mode: CollaboratorMode = 'list';
    @Input() collabs: GitHubUser[] | null = null;

    readonly maxVisibleCollaborators = 5;

    projectData = this.projectState.getProject;
    collaborators = computed(() => this.collabs ?? this.projectData().collaborators);

    // Remove collaborator with confirmation for removing self
    removeCollaborator(collab: GitHubUser) {
        const currentUser = this.exportGithub.user();
        if (currentUser && collab.id === currentUser.id) {
            this.confirmationService.confirm({
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
    private orgMembers: GitHubUser[] = [];
    selectedCollaborators: GitHubUser[] | [] = [];
    filteredCollaborators: GitHubUser[] = [];
    collabFilter = /^[a-zA-Z0-9-]*$/;

    // Initialize dropdown with org members
    async ngOnInit() {
        const owner = this.projectData().github.owner;
        if (owner) {
            //console.log('Fetching org members for: ', owner);
            this.orgMembers = await this.collaboratorService.getOrgMembers(owner);
            this.filteredCollaborators = [...this.orgMembers];
        }
    }

    // Filter collaborators (show all if empty, else filter by startsWith and then includes, else try to fetch user)
    async filterCollaborators(event: AutoCompleteCompleteEvent) {
        const query = event.query?.trim().toLowerCase().replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').substring(0, 39) || '';

        // If query is empty, return all org members
        if (query.length === 0) {
            this.filteredCollaborators = this.orgMembers;
            return;
        }

        // Filter existing org members
        // Note: we're not filtering out existing collaborators since this form can be used to update their user info
        const startsWith = this.orgMembers.filter(user =>
            user.login.toLowerCase().startsWith(query)
        );
        const includes = this.orgMembers.filter(user =>
            user.login.toLowerCase().includes(query) &&
            !user.login.toLowerCase().startsWith(query)
        );
        this.filteredCollaborators = Array.from(new Set([...startsWith, ...includes]));

        // If no matches found, try to fetch the typed username as a GitHub user
        if (this.filteredCollaborators.length === 0) {
            const userDetails = await this.collaboratorService.getUserDetails(query);
            if (userDetails) {
                this.filteredCollaborators = [userDetails];
            }
        }
    }

    // Find and update user details when a collaborator is selected (name and email will be missing initially)
    async onCollabSelect(event: AutoCompleteSelectEvent) {
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

    onDropdownClick() {
        this.filteredCollaborators = [...this.orgMembers];
    }

    // Add selected collaborators to project
    addSelectedCollaborators() {
        if (this.selectedCollaborators.length === 0) return;
        const updatedProject = this.collaboratorService.addCollaborators(this.projectData(), this.selectedCollaborators);
        this.projectState.setProject(updatedProject);
        this.selectedCollaborators = [];
    }

    // For share button (group mode)
    showShareDialog = false;
    openShareDialog() {
        this.showShareDialog = true;
    }
    closeShareDialog() {
        this.showShareDialog = false;
        this.selectedCollaborators = []; // Reset on close
    }

    // Request access button
    getRequestAccessMailto(): string {
        const emails = this.collaboratorService.getCollaboratorEmails(this.collaborators());
        const name = this.projectData().projectName;
        const user = this.exportGithub.user();
        if (emails.length === 0) return '';

        const subject = this.translate.instant('collaborators.email.requestAccess.subject', { name });
        const bodyEn = this.translate.instant('collaborators.email.requestAccess.bodyEN', { user, name });
        const bodyFr = this.translate.instant('collaborators.email.requestAccess.bodyFR', { user, name });
        const body = `${bodyEn}\n\n\n\n${bodyFr}`;

        return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    openMailto(mailto: string): void {
        window.open(mailto, '_self');
    }

}