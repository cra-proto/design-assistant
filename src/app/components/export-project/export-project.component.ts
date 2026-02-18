import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

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

    markForTranslation() {
        marker('export.github');
        marker('export.csv.inventory');
        marker('export.csv.tree');
        marker('export.json');
    }
    exportItems: MenuItem[] = [
        {
            label: 'export.github',
            icon: 'pi pi-github',
            routerLink: '/export-github'
        },
        {
            separator: true,
        },
        {
            label: 'export.csv.inventory',
            icon: 'pi pi-list-check',
            command: () => {
                this.projectState.exportTreeAsCsv();
            },
            disabled: false,
        },
        {
            label: 'export.csv.tree',
            icon: 'pi pi-align-right',
            command: () => {
                this.projectState.exportAsTreeCsv()
            },
            disabled: false,
        },
        {
            separator: true,
        },
        {
            label: 'export.json',
            icon: 'pi pi-code',
            command: () => {
                this.projectState.exportProjectAsJson();
            },
            disabled: false,
        },
    ];
}