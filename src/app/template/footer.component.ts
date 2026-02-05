import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { ThemeService } from '../services/theme.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-footer',
  imports: [TranslateModule],
  template: `
<footer>
    <div class="flex flex-row justify-content-between align-items-end mt-auto pt-2">
      <p class="white-space-nowrap text-color-secondary text-sm mb-0">{{'_app.version' | translate}} {{version}}</p>
      <img [src]="logoSrc" [alt]="'common.goc' | translate" class="opacity-70" />
    </div>
</footer>
`,
  styles: ``
})
export class FooterComponent {
  private theme = inject(ThemeService);
  version = environment.version

  get logoSrc() {
    return this.theme.darkMode() ? 'canada-logo-dark.png' : 'canada-logo.png';
  }
}
