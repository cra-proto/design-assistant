import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { PasswordModule } from 'primeng/password';

import { SignInService } from '../../../services/github/sign-in.service';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'aida-pat',
  imports: [FormsModule, TranslatePipe, ButtonModule, DialogModule, IftaLabelModule, PasswordModule],
  templateUrl: './pat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatComponent {
  private readonly signInService = inject(SignInService);

  protected get pat(): string {
    return this.signInService.pat;
  }

  protected set pat(value: string) {
    this.signInService.pat = value;
  }

  protected showHelp = false;
  protected readonly defaultOrg = environment.defaultOrg;
}
