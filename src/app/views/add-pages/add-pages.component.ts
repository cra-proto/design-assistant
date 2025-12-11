import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TreeNode } from 'primeng/api';

//PrimeNG modules
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';

import { CheckboxModule } from 'primeng/checkbox';
import { SelectButton } from 'primeng/selectbutton';
import { StepperModule } from 'primeng/stepper';

import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MessageService } from 'primeng/api';


import { AutoCompleteModule } from 'primeng/autocomplete';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { KeyFilterModule } from 'primeng/keyfilter';

//import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';


//Custom components and services
import { UrlItem, BreadcrumbNode } from './add-pages.model';
import { LinkListComponent } from './components/link-list.component';
import { FetchService } from '../../services/fetch.service';
import { ProjectStateService, ProjectTreeNodeData } from '../../services/project-state.service';
import { ProjectPhase } from '../../common/data.model';
import { ExportGitHubService } from '../ia-assistant/services/export-github.service';
import { GitHubAuthService } from '../../services/github-auth.service';



@Component({
    selector: 'aida-add-pages',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        InputTextModule, TextareaModule, SelectModule, IftaLabelModule, ButtonModule,
        SelectButton, StepperModule, CheckboxModule,
        AutoCompleteModule, KeyFilterModule,
        DrawerModule,

        ProgressBarModule,
        ConfirmPopupModule,


        MessageModule,
        LinkListComponent
    ],
    templateUrl: './add-pages.component.html',
    styles: `
    ::ng-deep .p-stepper .p-stepper-panel {
    flex: 0 0 auto !important;
}
`
})
export class AddPagesComponent implements OnInit {
    projectState = inject(ProjectStateService);
    fetchService = inject(FetchService);
    exportGitHubService = inject(ExportGitHubService);
    authService = inject(GitHubAuthService);

    confirmationService = inject(ConfirmationService);
    messageService = inject(MessageService);


    async ngOnInit(): Promise<void> {

    }

    //Add pages inputs
    rawUrls: string = '';
    parseUrls(): void { }


    //Project Data
    get projectData() {
        return this.projectState.getProject();
    }
    projectTree = this.projectData.projectData;
















}