import * as vscode from 'vscode'
import { generateCommitCommand } from './extension/commands'
import { registerExtensionSettings } from './extension/configuration'

export function activate(context: vscode.ExtensionContext) {
   // Register settings
   registerExtensionSettings(context)

   // Register the generate commit command
   const generateCommit = vscode.commands.registerCommand(
      'commiter_ai.generateCommit',
      generateCommitCommand
   )

   context.subscriptions.push(generateCommit)
}

export function deactivate() {}
