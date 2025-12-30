import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

//PrimeNG modules
import { IftaLabelModule } from 'primeng/iftalabel';
import { KeyFilterModule } from 'primeng/keyfilter';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { ProjectPhase } from '../../common/data.model';

@Component({
    selector: 'aida-setup-project',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        IftaLabelModule, KeyFilterModule, InputTextModule, SelectModule, SelectButtonModule,
    ],
    templateUrl: './setup-project.component.html',
    styles: ``
})
export class SetupProjectComponent {
    projectState = inject(ProjectStateService);
    authService = inject(GitHubAuthService);

    //Check if project is loaded
    get projectLoaded(): boolean {
        const name = this.projectState.getProject().projectName;
        return !!name;
    }

    //Project inputs
    get projectData() {
        return this.projectState.getProject();
    }

    //Project name
    get projectName(): string {
        return this.projectData.projectName;
    }
    set projectName(value: string) {
        this.projectState.setProjectName(value);
    }
    //GitHub repo
    get gitHubRepo(): string {
        return this.projectData.github.repo;
    }
    set gitHubRepo(value: string) {
        this.projectState.setGitHubRepo({ repo: value });
    }
    //Phase dropdown
    get projectPhase(): ProjectPhase {
        return this.projectData.phase;
    }
    set projectPhase(value: ProjectPhase) {
        this.projectState.setProjectPhase(value);
    }
    //Storage select button
    get projectStorage(): 'browser' | 'cloud' {
        return this.projectData.storageLocation;
    }
    set projectStorage(value: 'browser' | 'cloud') {
        this.projectState.setStorageLocation(value);
    }

    //Input options and filters
    nameFilter = /^[a-zA-Z0-9-._ :']*$/;

    phaseOptions = [
        { name: ProjectPhase.Draft, value: ProjectPhase.Draft },
        { name: ProjectPhase.Discover, value: ProjectPhase.Discover },
        { name: ProjectPhase.Assess, value: ProjectPhase.Assess },
        { name: ProjectPhase.Design, value: ProjectPhase.Design },
        { name: ProjectPhase.Approve, value: ProjectPhase.Approve },
        { name: ProjectPhase.Complete, value: ProjectPhase.Complete },
    ];

    storageOptions = [
        { name: 'storage.browser', value: 'browser' as const, icon: 'pi pi-desktop' },
        { name: 'storage.cloud', value: 'cloud' as const, icon: 'pi pi-cloud', disabled: !this.authService.isAuthenticated() }
    ];

    updateName() {
        this.projectName = this.projectName.trim().replace(/^[-._ :']+|[-._ :']+$/g, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_').replace(/\s+/g, ' ').replace(/[:]{2,}/g, ':').replace(/[']{2,}/g, '\'');
        this.projectState.setProjectName(this.projectName);
    }
    updateRepo() {
        this.gitHubRepo = this.gitHubRepo.trim().replace(/^[-._]+|[-._]+$/g, '').replace(/(\/|\.)lock$/, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_');
        this.projectState.setGitHubRepo({ repo: this.gitHubRepo });
    }
    //Autocompletes project or repo name based on the other if one is empty
    syncName() {
        if (!this.projectName && this.gitHubRepo) { this.projectName = this.gitHubRepo.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase()); this.updateName(); }
        if (this.projectName && !this.gitHubRepo) { this.gitHubRepo = this.projectName.replace(/[:']/g, '').replace(/\s+/g, '-').toLowerCase(); this.updateRepo(); }
    }
}