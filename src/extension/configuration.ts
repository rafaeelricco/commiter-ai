import * as vscode from 'vscode'

/**
 * Register extension settings and provide utility functions to access them
 * @param context VSCode extension context
 */
export function registerExtensionSettings(context: vscode.ExtensionContext) {
   // Register configuration change listener
   context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
         if (e.affectsConfiguration('commit_ai')) {
            // Handle configuration changes if needed
         }
      })
   )
}

/**
 * Check if the API key is set
 * @returns True if the API key is set, false otherwise
 */
export function isApiKeySet(): boolean {
   const apiKey = vscode.workspace
      .getConfiguration('commit_ai')
      .get<string>('api_key')
   return apiKey !== null && apiKey !== undefined && apiKey !== ''
}

/**
 * Get the API key from settings
 * @returns The API key or null if not set
 */
export function getApiKey(): string | null {
   return (
      vscode.workspace.getConfiguration('commit_ai').get<string>('api_key') ||
      null
   )
}

/**
 * Get the maximum number of tokens to generate
 * @returns The maximum number of tokens
 */
export function getMaxTokens(): number {
   return (
      vscode.workspace
         .getConfiguration('commit_ai')
         .get<number>('prompt.max_tokens') || 500
   )
}

/**
 * Get the custom prompt if set
 * @returns The custom prompt or empty string
 */
export function getCustomPrompt(): string {
   return (
      vscode.workspace
         .getConfiguration('commit_ai')
         .get<string>('prompt.custom_prompt') || ''
   )
}

/**
 * Get the temperature setting
 * @returns The temperature value
 */
export function getTemperature(): number {
   return (
      vscode.workspace
         .getConfiguration('commit_ai')
         .get<number>('prompt.temperature') || 0.7
   )
}

/**
 * Get the model to use
 * @returns The model identifier
 */
export function getModel(): string {
   return (
      vscode.workspace
         .getConfiguration('commit_ai')
         .get<string>('prompt.model') || 'google/gemini-2.0-pro-exp-02-05:free'
   )
}
