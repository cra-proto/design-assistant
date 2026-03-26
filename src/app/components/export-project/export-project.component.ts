import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { Router } from '@angular/router';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

//Services
import { ProjectStateService } from '../../services/project-state.service';

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
    private projectState = inject(ProjectStateService);
    private router = inject(Router);

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
            command: () => {
                this.router.navigate(['/export-github']);
            },
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