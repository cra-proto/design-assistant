import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';

@Component({
    selector: 'aida-export-project',
    imports: [
        TranslateModule,
        ButtonModule, MenuModule
    ],
    templateUrl: './export-project.component.html',
    styles: ``
})
export class ExportProjectComponent {

    projectState = inject(ProjectStateService);
    projectStorage = inject(ProjectStorageService);

    exportItems: MenuItem[] = [
        {
            label: 'GitHub',
            icon: 'pi pi-github',
            routerLink: '/export-github'
        },
        {
            separator: true,
        },
        {
            label: 'CSV (content inventory)',
            icon: 'pi pi-list-check',
            command: () => {
                this.projectState.exportTreeAsCsv();
            },
            disabled: false,
        },
        {
            label: 'CSV (tree testing)',
            icon: 'pi pi-align-right',
            command: () => {

            },
            disabled: true,
        },
        {
            separator: true,
        },
        {
            label: 'JSON file',
            icon: 'pi pi-code',
            command: () => {
                this.projectState.exportProjectAsJson();
            },
            disabled: false,
        },
    ];
}