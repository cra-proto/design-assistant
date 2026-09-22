import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'aida-add-pages-link',
  imports: [RouterLink, TranslatePipe, ButtonModule],
  templateUrl: './add-pages-link.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPagesLinkComponent {
  public readonly buttonOnly = input<boolean>(false);
}
