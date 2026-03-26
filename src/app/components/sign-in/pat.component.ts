import { Component, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";

import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { PasswordModule } from 'primeng/password';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

import { ExportGitHubService } from '../../services/github/export-github.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'aida-pat',
    imports: [TranslateModule, FormsModule,
        ButtonModule, IftaLabelModule, PasswordModule, TooltipModule, DialogModule],
    templateUrl: './pat.component.html',
    styles: ``
})
export class PatComponent {
    public exportGitHubService = inject(ExportGitHubService)

    @Input() validateOnBlur = false;

    get pat(): string {
        return this.exportGitHubService.pat;
    }

    set pat(value: string) {
        this.exportGitHubService.pat = value;
    }

    showHelp = false;
    defaultOrg = environment.defaultOrg;
}