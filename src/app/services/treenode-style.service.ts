import { Injectable, inject } from '@angular/core';
import { UserSettingsService } from './user-settings.service';
import { TreeNode } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class TreeNodeStyleService {
    private theme = inject(UserSettingsService)

    //TreeNode styles
    public updateNodeStyles(nodes: TreeNode[] | null, level = 0, applyStatusColors = true): void {
        if (!nodes) return;

        for (const node of nodes) {
            const borderStyle = 'border-2 border-primary border-round shadow-2';

            // Status-based colors override depth colors
            let bgStyle: string;
            if (!node.data?.status.inScope || node.data?.status.isContainer) {
                bgStyle = this.contextStyles['template'];
            } else if (node.data?.status.isNew && applyStatusColors) {
                bgStyle = this.contextStyles['new'];
            } else if (node.data?.status.isROT && applyStatusColors) {
                bgStyle = this.contextStyles['rot'];
            } else if (node.data?.status.isMoved && applyStatusColors) {
                bgStyle = this.contextStyles['move'];
            } else {
                bgStyle = this.bgColors[level % this.bgColors.length];
            }

            node.styleClass = `${borderStyle} ${bgStyle}`;

            if (node.children?.length) {
                const nextLevel = (!node.data?.status.inScope || node.data?.status.isContainer) ? level : level + 1;
                this.updateNodeStyles(node.children, nextLevel, applyStatusColors);
            }
        }
    }

    //Set background color
    get bgColors(): string[] {
        return this.theme.darkMode()
            ? this.bgColorsDark
            : this.bgColorsLight;
    }

    bgColorsLight: string[] = [
        "surface-0 hover:bg-primary-50",
        "bg-primary-50 hover:bg-primary-100",
        "bg-primary-100 hover:bg-primary-200",
        "bg-primary-200 hover:bg-primary-300",
        "bg-primary-300 hover:bg-primary-400",
        "bg-primary-400 hover:bg-primary-500",
        "bg-primary-500 hover:bg-primary-600 text-white",
        "bg-primary-600 hover:bg-primary-700 text-white",
        "bg-primary-700 hover:bg-primary-800 text-white",
        "bg-primary-800 hover:bg-primary-900 text-white",
    ];

    bgColorsDark: string[] = [
        "surface-0 hover:bg-primary-900",
        "bg-primary-900 hover:bg-primary-800",
        "bg-primary-800 hover:bg-primary-700",
        "bg-primary-700 hover:bg-primary-600",
        "bg-primary-600 hover:bg-primary-500",
        "bg-primary-500 hover:bg-primary-400",
        "bg-primary-400 hover:bg-primary-300 text-black",
        "bg-primary-300 hover:bg-primary-200 text-black",
        "bg-primary-200 hover:bg-primary-100 text-black",
        "bg-primary-100 hover:bg-primary-50 text-black",
    ];

    get contextStyles(): Record<string, string> {
        return this.theme.darkMode()
            ? this.contextStylesDark
            : this.contextStylesLight;
    }

    contextStylesLight: Record<string, string> = {
        new: 'bg-green-200 hover:bg-green-300 border-dashed text-black',
        rot: 'bg-red-200 hover:bg-red-300 border-dashed text-black',
        move: 'bg-yellow-200 hover:bg-yellow-300 border-dashed text-black',
        template: 'surface-200 hover:surface-300 text-black'
    };

    contextStylesDark: Record<string, string> = {
        new: 'bg-green-700 hover:bg-green-600 border-dashed text-white',
        rot: 'bg-red-700 hover:bg-red-600 border-dashed text-white',
        move: 'bg-yellow-700 hover:bg-yellow-600 border-dashed text-black',
        template: 'surface-200 hover:surface-300 text-white'
    };
}