import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { TextareaModule } from 'primeng/textarea';

import { FetchService } from '../../../../services/fetch.service';

import { TooltipDirective } from '../../../../common/tooltip.directive';

interface ScratchInput {
  id: number;
  text: string;
}

@Component({
  selector: 'aida-scratch-pad',
  imports: [FormsModule, TranslatePipe, ButtonModule, IftaLabelModule, InputGroupAddonModule, InputGroupModule, TextareaModule, TooltipDirective],
  templateUrl: './scratch-pad.component.html',
  styles: `
    p-inputgroup,
    p-inputgroup-addon,
    .p-inputgroup-addon {
      overflow: visible !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScratchPadComponent {
  private readonly fetchService = inject(FetchService);

  private nextId = 1;
  protected readonly inputs = signal<ScratchInput[]>([{ id: this.nextId++, text: '' }]);

  protected addInput() {
    this.inputs.update((list) => [...list, { id: this.nextId++, text: '' }]);
  }

  protected removeInput(id: number) {
    this.inputs.update((list) => list.filter((i) => i.id !== id));
  }

  protected updateText(id: number, text: string) {
    this.inputs.update((list) => list.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  protected gradeClasses(grade: number) {
    return grade > 9 ? 'text-red' : grade > 8 ? '' : 'text-green';
  }
  protected readonly stats = computed(() =>
    this.inputs().map((i) => ({
      id: i.id,
      characters: i.text.length,
      words: i.text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length,
      grade: i.text.trim() ? this.fetchService.getTextReadability(i.text.trim()) : { fleschKincaid: 0, gunningFog: 0 },
    })),
  );
}
