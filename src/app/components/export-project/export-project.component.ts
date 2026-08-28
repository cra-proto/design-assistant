import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';

import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';

@Component({
  selector: 'aida-export-project',
  imports: [TranslatePipe, ButtonModule, MenuModule],
  templateUrl: './export-project.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportProjectComponent {
  private translate = inject(TranslateService);
  private projectState = inject(ProjectStateService);
  private projectCache = inject(ProjectCacheService);
  private router = inject(Router);

  get exportItems(): MenuItem[] {
    return [
      {
        label: this.translate.instant('export.github'),
        icon: 'pi pi-github',
        command: () => {
          this.projectState.getProject().repoType = 'github';
          this.projectCache.checkLocalStatus();
          this.router.navigate(['/export-pages']);
        },
      },
      {
        label: this.translate.instant('export.html'),
        icon: 'pi pi-link',
        command: () => {
          this.projectState.getProject().repoType = 'local';
          this.projectCache.checkLocalStatus();
          this.router.navigate(['/export-pages']);
        },
      },
      {
        separator: true,
      },
      {
        label: this.translate.instant('export.csv.inventory'),
        icon: 'pi pi-list-check',
        command: () => {
          this.projectState.exportTreeAsCsv();
        },
        disabled: false,
      },
      {
        label: this.translate.instant('export.csv.tree'),
        icon: 'pi pi-align-right',
        command: () => {
          this.projectState.exportAsTreeCsv();
        },
        disabled: false,
      },
      {
        separator: true,
      },
      {
        label: this.translate.instant('export.json'),
        icon: 'pi pi-code',
        command: () => {
          this.projectState.exportProjectAsJson();
        },
        disabled: false,
      },
    ];
  }
}
