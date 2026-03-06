import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { UserSettingsService } from '../services/user-settings.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-footer',
  imports: [TranslateModule],
  template: `
<footer>
    <div class="flex flex-row justify-content-between align-items-end mt-auto pt-2">
      <p class="white-space-nowrap text-color-secondary text-sm mb-0">{{'_app.version' | translate}} {{version}}</p>
      <img [src]="logoSrc" [alt]="'common.goc' | translate" class="opacity-70 h-2rem md:h-3rem" />
    </div>
</footer>
`,
  styles: ``
})
export class FooterComponent {
  private settingsService = inject(UserSettingsService);
  version = environment.version

  get logoSrc() {
    return this.settingsService.darkMode() ? 'wmms-wht.svg' : 'wmms-blk.svg';
  }
}
