import OpenAI from 'openai';

// Initialize OpenAI client with Nebius API configuration
const client = new OpenAI({
    baseURL: 'https://api.studio.nebius.com/v1/',
    apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
    dangerouslyAllowBrowser: true,
});

// Default configuration
const DEFAULT_CONFIG = {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    maxTokens: 512,
    temperature: 0.6,
    topP: 0.9,
};

// Types
export interface NebiusMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface NebiusRequestOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
}

export interface NebiusResponse {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason: string;
}

// Main API client function
export const sendNebiusRequest = async (
    messages: NebiusMessage[],
    options: NebiusRequestOptions = {}
): Promise<NebiusResponse> => {
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
        throw new Error('Nebius API key is not set. Please set VITE_NEBIUS_API_KEY in your environment variables.');
    }

    try {
        const response = await client.chat.completions.create({
            model: options.model || DEFAULT_CONFIG.model,
            messages,
            max_tokens: options.maxTokens || DEFAULT_CONFIG.maxTokens,
            temperature: options.temperature || DEFAULT_CONFIG.temperature,
            top_p: options.topP || DEFAULT_CONFIG.topP,
            stream: false, // Explicitly set to false for non-streaming
        });

        // Type assertion to ensure we're working with a non-streaming response
        const chatCompletion = response as OpenAI.Chat.Completions.ChatCompletion;

        if (!chatCompletion.choices?.[0]?.message?.content) {
            throw new Error('No response content received from Nebius API');
        }

        return {
            content: chatCompletion.choices[0].message.content,
            usage: {
                promptTokens: chatCompletion.usage?.prompt_tokens || 0,
                completionTokens: chatCompletion.usage?.completion_tokens || 0,
                totalTokens: chatCompletion.usage?.total_tokens || 0,
            },
            model: chatCompletion.model,
            finishReason: chatCompletion.choices[0].finish_reason || 'unknown'
        };
    } catch (error) {
        console.error('Nebius API request failed:', error);
        throw new Error(`Nebius API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Streaming response handler
export const sendNebiusStreamRequest = async (
    messages: NebiusMessage[],
    options: NebiusRequestOptions = {},
    onChunk: (chunk: string) => void
): Promise<void> => {
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
        throw new Error('Nebius API key is not set. Please set VITE_NEBIUS_API_KEY in your environment variables.');
    }

    try {
        const stream = await client.chat.completions.create({
            model: options.model || DEFAULT_CONFIG.model,
            messages,
            max_tokens: options.maxTokens || DEFAULT_CONFIG.maxTokens,
            temperature: options.temperature || DEFAULT_CONFIG.temperature,
            top_p: options.topP || DEFAULT_CONFIG.topP,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
                onChunk(content);
            }
        }
    } catch (error) {
        console.error('Nebius streaming API request failed:', error);
        throw new Error(`Nebius streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Utility functions
export const validateApiKey = (): boolean => {
    const apiKey = import.meta.env.VITE_NEBIUS_API_KEY;
    return !!(apiKey && apiKey.startsWith('neb-'));
};

export const getAvailableModels = (): string[] => {
    return [
        'meta-llama/Meta-Llama-3.1-70B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-fast',
        // Add more models as they become available
    ];
};

export const estimateTokens = (text: string): number => {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
};

export const formatMessagesForPrompt = (messages: NebiusMessage[]): string => {
    return messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');
};

// Error handling utility
export const handleNebiusError = (error: any): string => {
    if (error?.response?.status === 401) {
        return 'Invalid API key. Please check your Nebius API key configuration.';
    } else if (error?.response?.status === 429) {
        return 'Rate limit exceeded. Please wait before making another request.';
    } else if (error?.response?.status === 500) {
        return 'Nebius API server error. Please try again later.';
    } else if (error?.code === 'ECONNREFUSED') {
        return 'Connection refused. Please check your internet connection.';
    } else {
        return error?.message || 'An unknown error occurred while calling Nebius API.';
    }
};
