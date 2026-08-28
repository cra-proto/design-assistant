import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { PasswordModule } from 'primeng/password';
import { TooltipModule } from 'primeng/tooltip';

import { ExportGitHubService } from '../../../services/github/export-github.service';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'aida-pat',
  imports: [FormsModule, TranslatePipe, ButtonModule, DialogModule, IftaLabelModule, PasswordModule, TooltipModule],
  templateUrl: './pat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatComponent {
  private readonly exportGitHubService = inject(ExportGitHubService);

  protected get pat(): string {
    return this.exportGitHubService.pat;
  }

  protected set pat(value: string) {
    this.exportGitHubService.pat = value;
  }

  protected showHelp = false;
  protected readonly defaultOrg = environment.defaultOrg;
}
