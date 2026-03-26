import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PromptConfig } from '../../common/prompts/prompt.model';
import { AiPromptService } from './prompt.service';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OpenRouterResponse {
    id: string;
    model: string;          // Which model actually responded (useful with fallbacks)
    choices: {
        message: ChatMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface AiRequestState {
    loading: boolean;
    error: string | null;
    respondingModel: string | null;  // Surfaces which fallback model answered
}

// Free models available on OpenRouter — update as needed
export const OpenRouterModels = {
    first: 'qwen/qwen3-next-80b-a3b-instruct:free',
    second: 'nvidia/nemotron-3-nano-30b-a3b:free',
    third: 'stepfun/step-3.5-flash:free',
} as const;

export type ModelKey = keyof typeof OpenRouterModels;

@Injectable({ providedIn: 'root' })
export class OpenRouterService {
    private http = inject(HttpClient);
    private aiPromptService = inject(AiPromptService)

    private readonly apiUrl = environment.openrouterFunctionUrl;

    // Default fallback chain — free models in preference order
    readonly defaultModels: string[] = [
        OpenRouterModels.first,
        OpenRouterModels.second,
        OpenRouterModels.third,
    ];

    readonly state = signal<AiRequestState>({
        loading: false,
        error: null,
        respondingModel: null,
    });

    // Returns full OpenRouter response
    async sendToAI(config: PromptConfig, content: string, models: string[] = this.defaultModels, temperature = 0): Promise<OpenRouterResponse> {
        this.state.set({ loading: true, error: null, respondingModel: null });

        try {
            const systemPrompt = this.aiPromptService.composePrompt(config);

            const response = await firstValueFrom(
                this.http.post<OpenRouterResponse>(this.apiUrl, {
                    models,
                    systemPrompt,
                    content,
                    temperature,
                })
            );

            this.state.set({
                loading: false,
                error: null,
                respondingModel: response.model ?? null,
            });

            return response;

        } catch (error: any) {
            const message = error?.error?.error ?? error?.message ?? 'Unknown error';
            this.state.set({ loading: false, error: message, respondingModel: null });
            throw error;
        }
    }

    // Returns just the text from the OpenRouter response
    async getTextFromAI(config: PromptConfig, content: string, models: string[] = this.defaultModels, temperature = 0): Promise<string> {
        const response = await this.sendToAI(config, content, models, temperature);
        return response.choices?.[0]?.message?.content ?? '';
    }
}