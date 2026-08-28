import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'aida-dev-tools',
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './dev-tools.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevToolsComponent {
  /**
   * Translation markers for visual separators in translation files.
   * These keys (feature._) create visual breaks between feature sections.
   * DO NOT REMOVE - needed to preserve separators during i18n:clean
   */
  markForTranslation() {
    //Separators
    marker('about._');
    marker('actions._');
    marker('addPages._');
    marker('aiPrompt._');
    marker('collaborators._');
    marker('common._');
    marker('compare._');
    marker('dashboard._');
    marker('dev._');
    marker('editNode._');
    marker('export._');
    marker('exportPages._');
    marker('feedback._');
    marker('findPages._');
    marker('github._');
    marker('help._');
    marker('iaDiagram._');
    marker('importPage._');
    marker('invalidUrls._');
    marker('inventory._');
    marker('nav._');
    marker('notFound._');
    marker('problems._');
    marker('project._');
    marker('project.github._');
    marker('project.message._');
    marker('project.phase._');
    marker('project.repo._');
    marker('project.setup._');
    marker('save._');
    marker('search._');
    marker('settings._');
    marker('standalone._');
    marker('switch._');
    marker('template._');
    marker('ucdg._');
    //Other
    marker('common.complete');
    marker('common.cra');
    marker('common.edited');
    marker('common.error');
    marker('common.pending');
  }
}
