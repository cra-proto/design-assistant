import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { ProjectCacheService } from '../../../services/project-cache.service';

@Component({
  selector: 'aida-edit-metadata',
  imports: [FormsModule, TranslatePipe, ButtonModule, IftaLabelModule, InputGroupAddonModule, InputGroupModule, InputTextModule, TextareaModule, TooltipModule],
  templateUrl: './edit-metadata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditMetadataComponent {
  protected readonly projectCache = inject(ProjectCacheService);
  readonly meta = input.required<{ title: string; description: string; keywords: string; h1: string; doubleH1?: string }>();
  readonly isProto = input<boolean>(false);
  readonly lang = input<'en' | 'fr'>('en');
  readonly disabled = input(false);

  readonly changed = output<void>();

  addonClasses(tooLong: boolean) {
    const colour = tooLong ? 'text-red' : 'text-green';
    const width = this.projectCache.selectedLang() === 'both' ? 'w-2' : 'w-1';
    return `secondary-outline text-center min-w-min ${colour} ${width}`;
  }

  generateTitleFromH1() {
    const h1 = this.meta().h1;
    const doubleH1 = this.meta().doubleH1 ? ` - ${this.meta().doubleH1}` : '';
    this.meta().title = h1 + doubleH1;
    this.changed.emit();
  }
}
