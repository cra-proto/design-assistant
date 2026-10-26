import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { ProjectCacheService } from '../../../services/project-cache.service';

import { DataVersion } from '../../../common/data.model';

@Component({
  selector: 'aida-edit-metadata',
  imports: [FormsModule, TranslatePipe, IftaLabelModule, InputTextModule, TextareaModule, InputGroupAddonModule, InputGroupModule],
  templateUrl: './edit-metadata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditMetadataComponent {
  protected readonly projectCache = inject(ProjectCacheService);
  readonly meta = input.required<{ title: string; description: string; keywords: string }>();
  readonly version = input<DataVersion>('prototype');
  readonly lang = input<'en' | 'fr'>('en');
  readonly disabled = input(false);

  readonly changed = output<void>();

  addonClasses(tooLong: boolean) {
    const colour = tooLong ? 'text-red' : 'text-green';
    const width = this.projectCache.selectedLang() === 'both' ? 'w-2' : 'w-1';
    return `secondary-outline text-center min-w-min ${colour} ${width}`;
  }
}
