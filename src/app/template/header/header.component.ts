import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';

import { SaveButtonComponent } from '../../components/save-button/save-button.component';
import { SignInButtonComponent } from '../../components/sign-in/sign-in-button/sign-in-button.component';

import { UserSettingsService } from '../../services/user-settings.service';

@Component({
  selector: 'aida-header',
  imports: [CommonModule, TranslatePipe, ButtonModule, SaveButtonComponent, SignInButtonComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly settingsService = inject(UserSettingsService);

  // Dark/Light logos for different breakpoints
  protected get logoSrc() {
    return this.settingsService.darkMode() ? 'images/sig-wht-en.svg' : 'images/sig-blk-en.svg';
  }
}
