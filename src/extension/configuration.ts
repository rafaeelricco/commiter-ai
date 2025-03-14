import * as vscode from 'vscode'

export function registerExtensionSettings(context: vscode.ExtensionContext) {
   context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
         if (e.affectsConfiguration('commiter_ai')) {
            const apiKeyChanged = e.affectsConfiguration('commiter_ai.api_key')
            const modelChanged = e.affectsConfiguration(
               'commiter_ai.prompt.model'
            )
            const soundSettingChanged = e.affectsConfiguration(
               'commiter_ai.sound_enabled'
            )

            if (apiKeyChanged) {
               const isKeySet = isApiKeySet()
               if (isKeySet) {
                  vscode.window.showInformationMessage(
                     'Commiter AI: API key atualizada com sucesso'
                  )
               } else {
                  vscode.window.showWarningMessage(
                     'Commiter AI: API key não configurada. A extensão não funcionará corretamente.'
                  )
               }
            }

            if (modelChanged) {
               vscode.window.showInformationMessage(
                  `Commiter AI: Modelo alterado para ${getModel()}`
               )
            }

            if (soundSettingChanged) {
               vscode.window.showInformationMessage(
                  `Commiter AI: Som de feedback alterado para ${isSoundEnabled() ? 'Ativo' : 'Desativo'}`
               )
            }
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

export function isSoundEnabled(): boolean {
   return vscode.workspace
      .getConfiguration('commiter_ai')
      .get<boolean>('sound_enabled', true)
}
