import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

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

            },
            disabled: true,
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

            },
            disabled: true,
        },
    ];
}