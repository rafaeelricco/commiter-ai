import * as vscode from 'vscode'

import { generateCommitCommand } from '@/extension/commands'
import { registerExtensionSettings } from '@/extension/configuration'

export function activate(context: vscode.ExtensionContext) {
   registerExtensionSettings(context)

   const gen = vscode.commands.registerCommand(
      'commiter_ai.generate_commit',
      generateCommitCommand
   )

   context.subscriptions.push(gen)
}

export function deactivate() {}
