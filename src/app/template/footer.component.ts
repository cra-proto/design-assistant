import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { ThemeService } from '../services/theme.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-footer',
  imports: [TranslateModule],
  template: `
<footer>
    <div class="flex flex-row justify-content-between align-items-end mt-2">
      <p class="white-space-nowrap text-color-secondary text-sm">{{'_app.version'|translate}} {{version}}</p>
      <img
          class="img-fluid fip-colour"
          [src]="logoSrc"
          [alt]="'common.GoC' | translate"
        />
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
