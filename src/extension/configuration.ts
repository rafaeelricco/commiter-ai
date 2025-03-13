import * as vscode from 'vscode'

export function registerExtensionSettings(context: vscode.ExtensionContext) {
   context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
         if (e.affectsConfiguration('commiter_ai')) {
         }
      })
   )
}

export function isApiKeySet(): boolean {
   const apiKey = vscode.workspace
      .getConfiguration('commiter_ai')
      .get<string>('api_key')
   return apiKey !== null && apiKey !== undefined && apiKey !== ''
}

export function getApiKey(): string | null {
   return (
      vscode.workspace.getConfiguration('commiter_ai').get<string>('api_key') ||
      null
   )
}

export function getMaxTokens(): number {
   return (
      vscode.workspace
         .getConfiguration('commiter_ai')
         .get<number>('prompt.max_tokens') || 500
   )
}

export function getCustomPrompt(): string {
   return (
      vscode.workspace
         .getConfiguration('commiter_ai')
         .get<string>('prompt.custom_prompt') || ''
   )
}

export function getTemperature(): number {
   return (
      vscode.workspace
         .getConfiguration('commiter_ai')
         .get<number>('prompt.temperature') || 0.7
   )
}

export function getModel(): string {
   return (
      vscode.workspace
         .getConfiguration('commiter_ai')
         .get<string>('prompt.model') || 'google/gemini-2.0-pro-exp-02-05:free'
   )
}

export function getCommitStyle(): string {
   return (
      vscode.workspace
         .getConfiguration('commiter_ai')
         .get<string>('prompt.commit_style') || 'conventional'
   )
}
