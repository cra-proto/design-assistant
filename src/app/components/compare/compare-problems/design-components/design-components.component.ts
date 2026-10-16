import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'aida-design-components',
  imports: [CommonModule, TranslatePipe, ButtonModule, CheckboxModule, TableModule],
  templateUrl: './design-components.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignComponentsComponent {}
