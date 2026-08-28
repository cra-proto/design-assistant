import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { UserSettingsService } from '../services/user-settings.service';

import { version as appVersion } from '../../../package.json';

/**
 * Reviewed: 2026-08-13 (ng21)
 *
 * Footer with currect version and theme-responsive logo
 */
@Component({
  selector: 'aida-footer',
  imports: [TranslatePipe],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  private readonly settingsService = inject(UserSettingsService);
  protected readonly appVersion = appVersion;

  protected get logoSrc() {
    return this.settingsService.darkMode() ? 'images/wmms-wht.svg' : 'images/wmms-blk.svg';
  }
}
