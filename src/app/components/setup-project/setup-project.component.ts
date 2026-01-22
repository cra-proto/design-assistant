import { Component, inject, effect } from '@angular/core';
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
import { ExportGitHubService } from '../../services/github/export-github.service';
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
    exportGitHubService = inject(ExportGitHubService);

    constructor() {
        // Refresh projectName when there are changes to repo name
        effect(() => {
            const stateRepo = this.projectData.github.repo;
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
    }

    //Phase dropdown
    get projectPhase(): ProjectPhase {
        return this.projectData.phase;
    }
    set projectPhase(value: ProjectPhase) {
        this.projectState.setProjectPhase(value);
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

    storageOptions = [
        { name: 'storage.browser', value: 'local' as const, icon: 'pi pi-desktop' },
        { name: 'storage.cloud', value: 'cloud' as const, icon: 'pi pi-cloud', disabled: this.exportGitHubService.canEditProject }
    ];

}