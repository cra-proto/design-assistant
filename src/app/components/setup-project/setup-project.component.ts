import { Component, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//PrimeNG modules
import { IftaLabelModule } from 'primeng/iftalabel';
import { KeyFilterModule } from 'primeng/keyfilter';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageModule } from 'primeng/message';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { CollaboratorService } from '../../services/collaborator.service';
import { ProjectPhase } from '../../common/data.model';

@Component({
    selector: 'aida-setup-project',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        IftaLabelModule, KeyFilterModule, InputTextModule, SelectModule, SelectButtonModule, MessageModule
    ],
    templateUrl: './setup-project.component.html',
    styles: ``
})
export class SetupProjectComponent {
    private projectState = inject(ProjectStateService);
    private collaboratorService = inject(CollaboratorService);
    router = inject(Router);

    constructor() {
        // Refresh projectName when there are changes to repo name (for initial sync fxn)
        effect(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const stateRepo = this.projectData.github.repo; // waching for changes to repo name
            this.projectName = this.projectData.projectName;
        });
    }

    //Project data
    get projectData() {
        return this.projectState.getProject();
    }

    //Name input
    projectName = this.projectData.projectName;
    nameFilter = /^[a-zA-Z0-9-._ :']*$/;
    updateName() {
        this.projectName = this.projectName.trim().replace(/^[-._ :']+|[-._ :']+$/g, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_').replace(/\s+/g, ' ').replace(/[:]{2,}/g, ':').replace(/[']{2,}/g, '\'');
        this.projectState.setProjectName(this.projectName);
        // Manage routes for named projects
        if (this.router.url === '/new-project' && this.projectName) {
            this.router.navigate(['/edit-project']);
        }
        else if (this.router.url === '/edit-project' && !this.projectName) {
            this.router.navigate(['/new-project']);
        }
    }

    //Phase dropdown
    get projectPhase(): ProjectPhase {
        return this.projectData.phase;
    }
    set projectPhase(value: ProjectPhase) {
        this.projectState.setProjectPhase(value);
    }

    markForTranslation() {
        marker('project.setup.storage.local');
        marker('project.setup.storage.cloud');
        marker('project.phase.approve');
        marker('project.phase.assess');
        marker('project.phase.complete');
        marker('project.phase.design');
        marker('project.phase.discover');
        marker('project.phase.draft');
        marker('project.phase.status.complete');
        marker('project.phase.status.current');
        marker('project.phase.status.pending');
    }

    phaseOptions = [
        { name: ProjectPhase.Draft, value: ProjectPhase.Draft },
        { name: ProjectPhase.Discover, value: ProjectPhase.Discover },
        { name: ProjectPhase.Assess, value: ProjectPhase.Assess },
        { name: ProjectPhase.Design, value: ProjectPhase.Design },
        { name: ProjectPhase.Approve, value: ProjectPhase.Approve },
        { name: ProjectPhase.Complete, value: ProjectPhase.Complete },
    ];

    //Storage select button
    get projectStorage(): 'local' | 'cloud' {
        return this.projectData.storageType;
    }
    set projectStorage(value: 'local' | 'cloud') {
        this.projectState.setStorageType(value);
    }

    storageOptions = computed(() => [
        { name: 'project.setup.storage.local', value: 'local' as const, icon: 'pi pi-desktop' },
        { name: 'project.setup.storage.cloud', value: 'cloud' as const, icon: 'pi pi-cloud', disabled: !this.collaboratorService.canEditProject(this.projectState.getProject()) }
    ]);

}