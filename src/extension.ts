import * as vscode from 'vscode'

import { generateCommitCommand } from '@/extension/commands'
import { CommitViewProvider } from '@/extension/commit-view'
import { registerExtensionSettings } from '@/extension/configuration'

export function activate(context: vscode.ExtensionContext) {
   registerExtensionSettings(context)

   const gen = vscode.commands.registerCommand(
      'commiter_ai.generate_commit',
      generateCommitCommand
   )

   context.subscriptions.push(gen)

   const provider = new CommitViewProvider(context.extensionUri)
   context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
         CommitViewProvider.viewType,
         provider
      )
   )
}

export function deactivate() {}
