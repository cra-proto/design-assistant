import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { DataVersion } from '../../../common/data.model';

@Component({
  selector: 'aida-edit-metadata',
  imports: [FormsModule, TranslatePipe, IftaLabelModule, InputTextModule, TextareaModule],
  templateUrl: './edit-metadata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditMetadataComponent {
  readonly meta = input.required<{ title: string; description: string; keywords: string }>();
  readonly version = input<DataVersion>('prototype');
  readonly lang = input<'en' | 'fr'>('en');
  readonly disabled = input(false);

  readonly changed = output<void>();
}
