import * as vscode from 'vscode'
import { generateCommitMessage } from './api'

// Function to get nonce for CSP
function getNonce() {
   let text = ''
   const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
   for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
   }
   return text
}

// Interface para representar uma mudança no arquivo Git
interface GitChange {
   uri: vscode.Uri
   status: string
   relativePath?: string
}

// Interface para representar um repositório Git
interface GitRepository {
   state: {
      HEAD?: { name: string }
      indexChanges: GitChange[]
      workingTreeChanges: GitChange[]
      untrackedChanges: GitChange[]
   }
   inputBox: {
      value: string
   }
   rootUri: vscode.Uri
   add: (paths: string[]) => Promise<void>
   revert: (paths: string[]) => Promise<void>
   commit: (message: string) => Promise<void>
   clean: (resources: vscode.Uri[]) => Promise<void>
   show: (resource: string) => Promise<string>
}

// Interface que representa a API do Git do VS Code
interface GitAPI {
   repositories: GitRepository[]
}

export class CommitViewProvider implements vscode.WebviewViewProvider {
   public static readonly viewType = 'commiterAiView'

   private _view?: vscode.WebviewView
   private _gitApi?: GitAPI // Cache Git API
   private _isGenerating: boolean = false

   constructor(private readonly _extensionUri: vscode.Uri) {}

   public resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
   ) {
      this._view = webviewView

      webviewView.webview.options = {
         enableScripts: true,
         localResourceRoots: [this._extensionUri] // Allow loading resources from extension root
      }

      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

      // Poll for repository updates every 3 seconds
      this._startRepositoryPolling()

      webviewView.webview.onDidReceiveMessage(async (data) => {
         switch (data.type) {
            case 'getRepositoryState': {
               await this._sendRepositoryState()
               break
            }
            case 'stageFile': {
               await this._stageFile(data.value)
               break
            }
            case 'unstageFile': {
               await this._unstageFile(data.value)
               break
            }
            case 'stageAllChanges': {
               await this._stageAllChanges()
               break
            }
            case 'unstageAllChanges': {
               await this._unstageAllChanges()
               break
            }
            case 'refreshChanges': {
               await this._sendRepositoryState()
               break
            }
            case 'generateCommit': {
               await this._generateCommitMessage()
               break
            }
            case 'commit': {
               await this._commitChanges(data.value)
               break
            }
            case 'openDiff': {
               await this._openDiff(data.value)
               break
            }
            case 'discardChanges': {
               await this._discardChanges(data.value)
               break
            }
            case 'showSettings': {
               vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  '@ext:r1cco.commiter-ai-generator'
               )
               break
            }
         }
      })
   }

   private async _sendRepositoryState() {
      const gitApi = await this._ensureGitApi()
      if (!gitApi || gitApi.repositories.length === 0) {
         this._view?.webview.postMessage({
            type: 'repositoryState',
            value: { error: 'Repositório Git não encontrado' }
         })
         return
      }

      const repo = gitApi.repositories[0]

      try {
         // Get repository state including staged, unstaged, and untracked files
         const state = {
            branch: repo.state.HEAD?.name || '',
            staged: this._formatChangedFiles(repo.state.indexChanges || []),
            unstaged: this._formatChangedFiles(
               repo.state.workingTreeChanges || []
            ),
            untracked: this._formatChangedFiles(
               repo.state.untrackedChanges || []
            ),
            commitMessage: repo.inputBox.value,
            isGenerating: this._isGenerating
         }

         this._view?.webview.postMessage({
            type: 'repositoryState',
            value: state
         })
      } catch (error) {
         console.error('Error getting repository state:', error)
         this._view?.webview.postMessage({
            type: 'error',
            value:
               'Error getting repository state: ' +
               (error instanceof Error ? error.message : String(error))
         })
      }
   }

   private _formatChangedFiles(changes: any[] = []) {
      return changes.map((change) => {
         // Get the file path relative to the repository root
         const path = change.uri.path
         const relativePath = change.relativePath || path.split('/').pop()

         // For files in subfolders, we need the folder path and filename separate
         const pathParts = relativePath.split('/')
         const fileName = pathParts.pop() || ''
         const folderPath =
            pathParts.length > 0 ? pathParts.join('/') + '/' : ''

         return {
            fileName,
            folderPath,
            relativePath,
            fullPath: path,
            status: change.status,
            uri: change.uri.toString(),
            statusText: this._getStatusText(change.status),
            statusCode: this._getStatusCode(change.status)
         }
      })
   }

   private _getStatusText(status: string): string {
      switch (status) {
         case 'A':
            return 'Added'
         case 'M':
            return 'Modified'
         case 'D':
            return 'Deleted'
         case 'R':
            return 'Renamed'
         case 'C':
            return 'Copied'
         case 'U':
            return 'Unmerged'
         case '?':
            return 'Untracked'
         default:
            return status
      }
   }

   private _getStatusCode(status: string): string {
      switch (status) {
         case 'A':
            return 'A'
         case 'M':
            return 'M'
         case 'D':
            return 'D'
         case 'R':
            return 'R'
         case 'C':
            return 'C'
         case 'U':
            return 'U'
         case '?':
            return '?'
         default:
            return status
      }
   }

   private async _stageFile(uri: string) {
      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         const repo = gitApi.repositories[0]

         // Convert string URI back to vscode URI object
         const fileUri = vscode.Uri.parse(uri)

         // Use repository's API directly
         await repo.add([fileUri.fsPath])

         // Update UI after a small delay to ensure Git has updated
         setTimeout(() => this._sendRepositoryState(), 300)
      } catch (error) {
         console.error('Error staging file:', error)
         vscode.window.showErrorMessage(
            'Error staging file: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _unstageFile(uri: string) {
      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         const repo = gitApi.repositories[0]

         // Convert string URI back to vscode URI object
         const fileUri = vscode.Uri.parse(uri)

         // Use repository's API directly
         await repo.revert([fileUri.fsPath])

         // Update UI after a small delay to ensure Git has updated
         setTimeout(() => this._sendRepositoryState(), 300)
      } catch (error) {
         console.error('Error unstaging file:', error)
         vscode.window.showErrorMessage(
            'Error unstaging file: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _stageAllChanges() {
      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         // Use VS Code's built-in Git commands
         await vscode.commands.executeCommand('git.stageAll')

         // Update UI
         setTimeout(() => this._sendRepositoryState(), 300)
      } catch (error) {
         console.error('Error staging all changes:', error)
         vscode.window.showErrorMessage(
            'Error staging all changes: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _unstageAllChanges() {
      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         // Use VS Code's built-in Git commands
         await vscode.commands.executeCommand('git.unstageAll')

         // Update UI
         setTimeout(() => this._sendRepositoryState(), 300)
      } catch (error) {
         console.error('Error unstaging all changes:', error)
         vscode.window.showErrorMessage(
            'Error unstaging all changes: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _openDiff(uri: string) {
      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         const fileUri = vscode.Uri.parse(uri)

         await vscode.commands.executeCommand(
            'vscode.diff',
            toGitUri(fileUri, '~'), // Previous version
            fileUri, // Current version
            'File Changes'
         )
      } catch (error) {
         console.error('Error opening diff:', error)
         vscode.window.showErrorMessage(
            'Error opening diff: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _discardChanges(uri: string) {
      const result = await vscode.window.showWarningMessage(
         'Are you sure you want to discard all changes to this file?',
         { modal: true },
         'Discard Changes'
      )

      if (result === 'Discard Changes') {
         try {
            const gitApi = await this._ensureGitApi()
            if (!gitApi || gitApi.repositories.length === 0) return

            const repo = gitApi.repositories[0]
            const fileUri = vscode.Uri.parse(uri)

            await repo.clean([fileUri])

            // Update UI
            setTimeout(() => this._sendRepositoryState(), 300)
         } catch (error) {
            console.error('Error discarding changes:', error)
            vscode.window.showErrorMessage(
               'Error discarding changes: ' +
                  (error instanceof Error ? error.message : String(error))
            )
         }
      }
   }

   private async _commitChanges(message: string) {
      if (!message.trim()) {
         vscode.window.showErrorMessage('Commit message cannot be empty')
         return
      }

      try {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         const repo = gitApi.repositories[0]
         await repo.commit(message)

         // Update UI
         setTimeout(() => this._sendRepositoryState(), 300)

         vscode.window.showInformationMessage('Changes committed successfully!')
      } catch (error) {
         console.error('Error committing changes:', error)
         vscode.window.showErrorMessage(
            'Error committing changes: ' +
               (error instanceof Error ? error.message : String(error))
         )
      }
   }

   private async _generateCommitMessage() {
      const gitApi = await this._ensureGitApi()
      if (!gitApi || gitApi.repositories.length === 0) {
         vscode.window.showErrorMessage(
            'Não foi possível acessar o repositório Git.'
         )
         this._view?.webview.postMessage({
            type: 'error',
            value: 'Não foi possível acessar o repositório Git.'
         })
         return
      }

      const repo = gitApi.repositories[0]
      const indexChanges = repo.state.indexChanges || []

      if (indexChanges.length === 0) {
         vscode.window.showErrorMessage(
            'Nenhuma mudança em stage para gerar commit.'
         )
         this._view?.webview.postMessage({
            type: 'error',
            value: 'Nenhuma mudança em stage para gerar commit.'
         })
         return
      }

      // Indicate that we are generating the commit
      this._isGenerating = true
      this._view?.webview.postMessage({ type: 'generating' })
      await this._sendRepositoryState()

      try {
         // Get formatted diff for AI
         const diffData = await this._getDiffFormatted(repo, indexChanges)

         if (!diffData) {
            throw new Error('Não foi possível obter os dados do diff.')
         }

         // Check API key
         const apiKey = vscode.workspace
            .getConfiguration('commiter_ai')
            .get<string>('api_key')
         if (!apiKey) {
            throw new Error(
               'API Key não configurada. Configure em Settings > Extensions > Commiter Ai.'
            )
         }

         // Generate commit message
         const commitMessage = await generateCommitMessage(diffData)

         // Update commit message in SCM input
         repo.inputBox.value = commitMessage

         // Notify success
         this._view?.webview.postMessage({
            type: 'successCommitGeneration',
            value: commitMessage
         })

         // Play sound if enabled
         const soundEnabled = vscode.workspace
            .getConfiguration('commiter_ai')
            .get<boolean>('sound_enabled')
         if (soundEnabled) {
            try {
               const soundPlay = require('sound-play')
               const soundPath = vscode.Uri.joinPath(
                  this._extensionUri,
                  'assets',
                  'success.MP3'
               ).fsPath
               await soundPlay.play(soundPath)
            } catch (soundError) {
               console.error('Failed to play sound:', soundError)
            }
         }
      } catch (error) {
         console.error('Erro ao gerar commit:', error)
         const errorMessage =
            error instanceof Error ? error.message : String(error)
         vscode.window.showErrorMessage('Erro ao gerar commit: ' + errorMessage)
         this._view?.webview.postMessage({
            type: 'error',
            value: errorMessage
         })
      } finally {
         this._isGenerating = false
         await this._sendRepositoryState()
      }
   }

   private _startRepositoryPolling() {
      setInterval(async () => {
         if (this._view && this._view.visible) {
            await this._sendRepositoryState()
         }
      }, 3000)
   }

   private async _ensureGitApi() {
      if (this._gitApi) {
         return this._gitApi
      }
      try {
         const gitExtension = vscode.extensions.getExtension('vscode.git')
         if (!gitExtension) {
            throw new Error('Extensão Git do VS Code não encontrada.')
         }
         if (!gitExtension.isActive) {
            await gitExtension.activate()
         }
         this._gitApi = gitExtension.exports.getAPI(1)
         if (!this._gitApi) {
            throw new Error('Não foi possível obter a API do Git (versão 1).')
         }
         return this._gitApi
      } catch (error) {
         console.error('Erro ao obter API do Git:', error)
         vscode.window.showErrorMessage(
            'Erro ao inicializar Git: ' +
               (error instanceof Error ? error.message : String(error))
         )
         this._gitApi = undefined
         return undefined
      }
   }

   private async _getDiffFormatted(
      repo: GitRepository,
      indexChanges: GitChange[]
   ): Promise<string> {
      // Build a text format diff from indexed changes
      let diffOutput = 'STAGED CHANGES SUMMARY:\n\n'

      // First, show a summary of changed files
      diffOutput += 'Files changed:\n'
      for (const change of indexChanges) {
         // Extract relative file name from URI
         const filePath = change.uri.path.split('/').pop() || change.uri.path
         diffOutput += change.status + ' ' + filePath + '\n'
      }

      diffOutput += '\n--- DETAILED CHANGES ---\n\n'

      // Now show detailed changes
      for (const change of indexChanges) {
         // Extract relative file name from URI
         const filePath = change.uri.path.split('/').pop() || change.uri.path

         // Add file header for each change
         diffOutput += 'File: ' + filePath + ' (' + change.status + ')\n'

         // Status type description
         let statusDescription = ''
         switch (change.status) {
            case 'A':
               statusDescription = 'Added (new file)'
               break
            case 'M':
               statusDescription = 'Modified'
               break
            case 'D':
               statusDescription = 'Deleted'
               break
            case 'R':
               statusDescription = 'Renamed'
               break
            case 'C':
               statusDescription = 'Copied'
               break
            default:
               statusDescription = change.status
         }

         diffOutput += 'Status: ' + statusDescription + '\n'

         // Get detailed diff for this file
         try {
            // For added, modified, or copied files, get content
            if (change.status !== 'D') {
               // Not a deleted file
               try {
                  const fileContent = await repo.show(change.uri.toString())

                  if (typeof fileContent === 'string') {
                     // For text files, show the first lines
                     const lines = fileContent.split('\n')
                     const previewLines = lines.slice(
                        0,
                        Math.min(15, lines.length)
                     )

                     diffOutput += '\nPreview content:\n'
                     diffOutput +=
                        previewLines.map((line) => '+ ' + line).join('\n') +
                        '\n'

                     // If file is large, indicate how many lines were omitted
                     if (lines.length > 15) {
                        diffOutput +=
                           '\n... (' +
                           (lines.length - 15) +
                           ' more lines) ...\n'
                     }
                  } else {
                     diffOutput += 'Arquivo binário ou não suportado.\n'
                  }
               } catch (contentError) {
                  diffOutput +=
                     'Não foi possível obter o conteúdo: ' +
                     (contentError instanceof Error
                        ? contentError.message
                        : String(contentError)) +
                     '\n'
               }
            } else {
               diffOutput += '\nFile was deleted\n'
            }

            diffOutput += '\n----------------------------------------\n\n'
         } catch (fileError) {
            diffOutput +=
               'Erro ao processar arquivo: ' +
               (fileError instanceof Error
                  ? fileError.message
                  : String(fileError)) +
               '\n\n'
         }
      }

      return diffOutput
   }

   private _getHtmlForWebview(webview: vscode.Webview): string {
      // Use a nonce for security
      const nonce = getNonce()

      return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Commiter AI</title>
                <style>
                    :root {
                        --section-gap: 0px;
                        --border-radius: 0px;
                        --animation-duration: 0.2s;
                        --scm-background: var(--vscode-sideBar-background);
                        --file-badge-color: var(--vscode-editorInfo-foreground);
                    }
                    
                    body {
                        padding: 0;
                        margin: 0;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--scm-background);
                        font-size: var(--vscode-font-size);
                        overflow: hidden;
                        height: 100vh;
                    }
                    
                    * {
                        box-sizing: border-box;
                    }
                    
                    .container {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        overflow: hidden;
                    }
                    
                    header {
                        padding: 8px 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    header h1 {
                        font-size: 14px;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: normal;
                    }
                    
                    .sparkle-icon {
                        padding-right: 4px;
                    }
                    
                    .icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .settings-icon {
                        cursor: pointer;
                        opacity: 0.7;
                        transition: opacity 0.2s;
                    }
                    
                    .settings-icon:hover {
                        opacity: 1;
                    }
                    
                    .sections {
                        flex: 1;
                        overflow-y: auto;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .section {
                        margin-bottom: var(--section-gap);
                    }
                    
                    .section-header {
                        padding: 4px 20px 4px 12px;
                        font-weight: 600;
                        font-size: 13px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        cursor: pointer;
                        user-select: none;
                        position: sticky;
                        top: 0;
                        z-index: 1;
                        background-color: var(--scm-background);
                    }
                    
                    .section-header-left {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    
                    .section-header-actions {
                        display: flex;
                        gap: 12px;
                        opacity: 0.7;
                    }
                    
                    .section-header-actions .icon {
                        cursor: pointer;
                    }
                    
                    .section-header-actions .icon:hover {
                        opacity: 0.8;
                    }
                    
                    .arrow-icon {
                        transition: transform var(--animation-duration);
                    }
                    
                    .collapsed .arrow-icon {
                        transform: rotate(-90deg);
                    }
                    
                    .badge {
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        border-radius: 10px;
                        font-size: 11px;
                        padding: 0 6px;
                        min-width: 18px;
                        height: 18px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: 8px;
                    }
                    
                    .section-content {
                        overflow: hidden;
                        max-height: 5000px;
                        transition: max-height var(--animation-duration) ease;
                    }
                    
                    .collapsed .section-content {
                        max-height: 0;
                    }
                    
                    .file-list {
                        list-style: none;
                        margin: 0;
                        padding: 0;
                    }
                    
                    .file-item {
                        padding: 3px 12px 3px 24px;
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        font-size: 13px;
                        position: relative;
                    }
                    
                    .file-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .file-item.selected {
                        background-color: var(--vscode-list-activeSelectionBackground);
                        color: var(--vscode-list-activeSelectionForeground);
                    }
                    
                    .file-icon {
                        width: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 6px;
                        flex-shrink: 0;
                    }
                    
                    .file-path {
                        white-space: nowrap;
                        text-overflow: ellipsis;
                        overflow: hidden;
                        flex: 1;
                    }
                    
                    .file-status-badge {
                        margin-left: 8px;
                        color: var(--file-badge-color);
                        font-size: 12px;
                        font-weight: 600;
                    }
                    
                    .file-actions {
                        display: none;
                        position: absolute;
                        right: 12px;
                        gap: 8px;
                    }
                    
                    .file-item:hover .file-status-badge {
                        display: none;
                    }
                    
                    .file-item:hover .file-actions {
                        display: flex;
                    }
                    
                    .file-action {
                        color: var(--vscode-icon-foreground);
                        cursor: pointer;
                        opacity: 0.8;
                        transition: opacity 0.2s;
                    }
                    
                    .file-action:hover {
                        opacity: 1;
                    }
                    
                    .commit-section {
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    
                    .commit-textarea {
                        width: 100%;
                        resize: vertical;
                        min-height: 60px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border, transparent);
                        border-radius: var(--border-radius);
                        padding: 8px 10px;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                    }
                    
                    .commit-textarea:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                    }
                    
                    .commit-actions {
                        display: flex;
                        gap: 8px;
                    }
                    
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border, transparent);
                        border-radius: var(--border-radius);
                        padding: 6px 14px;
                        cursor: pointer;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        white-space: nowrap;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        height: 30px;
                    }
                    
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    
                    .secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    .secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .full-width {
                        flex: 1;
                    }
                    
                    .loading-spinner {
                        display: inline-block;
                        width: 14px;
                        height: 14px;
                        border: 2px solid transparent;
                        border-top-color: var(--vscode-editor-foreground);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    .empty-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 24px 16px;
                        color: var(--vscode-disabledForeground);
                    }
                    
                    .empty-state-icon {
                        font-size: 24px;
                        margin-bottom: 12px;
                    }
                    
                    .status-message {
                        font-size: 12px;
                        padding: 8px;
                        margin-top: 0;
                        border-radius: var(--border-radius);
                    }
                    
                    .status-success {
                        color: var(--vscode-inputValidation-infoForeground);
                        background-color: var(--vscode-inputValidation-infoBackground);
                        border: 1px solid var(--vscode-inputValidation-infoBorder);
                    }
                    
                    .status-error {
                        color: var(--vscode-inputValidation-errorForeground);
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                    }
                    
                    .branch-info {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-left: 12px;
                    }
                    
                    .dropdown-button {
                        margin-left: auto;
                        margin-right: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>
                            <span class="sparkle-icon">✨</span> 
                            Commiter AI
                            <span class="branch-info" id="branch-info"></span>
                        </h1>
                        <span class="icon settings-icon" id="settings-button">⚙️</span>
                    </header>
                    
                    <div class="sections">
                        <div class="section" id="changes-section">
                            <div class="section-header">
                                <div class="section-header-left">
                                    <span class="arrow-icon">▼</span>
                                    <span>Changes</span>
                                    <span class="badge" id="changes-badge">0</span>
                                </div>
                                <div class="section-header-actions">
                                    <span class="icon" id="stage-all-button" title="Stage All Changes">+</span>
                                    <span class="icon" id="refresh-button" title="Refresh">↻</span>
                                </div>
                            </div>
                            <div class="section-content">
                                <ul class="file-list" id="changes-list"></ul>
                            </div>
                        </div>
                        
                        <div class="section" id="staged-section">
                            <div class="section-header">
                                <div class="section-header-left">
                                    <span class="arrow-icon">▼</span>
                                    <span>Staged Changes</span>
                                    <span class="badge" id="staged-badge">0</span>
                                </div>
                                <div class="section-header-actions">
                                    <span class="icon" id="unstage-all-button" title="Unstage All">-</span>
                                </div>
                            </div>
                            <div class="section-content">
                                <ul class="file-list" id="staged-list"></ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="commit-section">
                        <textarea 
                            id="commit-message" 
                            class="commit-textarea" 
                            placeholder="Type your commit message here or use AI to generate..."></textarea>
                        
                        <div class="commit-actions">
                            <button id="generate-button" class="secondary">
                                <span class="icon">✨</span>
                                Generate Message
                            </button>
                            <button id="commit-button" class="full-width" disabled>
                                <span class="icon">✓</span>
                                Commit
                            </button>
                        </div>
                        
                        <div id="status-message" style="display: none;" class="status-message"></div>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // UI Elements
                    const changesSection = document.getElementById('changes-section');
                    const stagedSection = document.getElementById('staged-section');
                    const changesList = document.getElementById('changes-list');
                    const stagedList = document.getElementById('staged-list');
                    const changesBadge = document.getElementById('changes-badge');
                    const stagedBadge = document.getElementById('staged-badge');
                    const commitMessage = document.getElementById('commit-message');
                    const generateButton = document.getElementById('generate-button');
                    const commitButton = document.getElementById('commit-button');
                    const statusMessage = document.getElementById('status-message');
                    const settingsButton = document.getElementById('settings-button');
                    const branchInfo = document.getElementById('branch-info');
                    const stageAllButton = document.getElementById('stage-all-button');
                    const unstageAllButton = document.getElementById('unstage-all-button');
                    const refreshButton = document.getElementById('refresh-button');
                    
                    // State
                    let state = {
                        branch: '',
                        staged: [],
                        unstaged: [],
                        untracked: []
                    };
                    
                    // Initialize
                    initializeUI();
                    vscode.postMessage({ type: 'getRepositoryState' });
                    
                    function initializeUI() {
                        // Section collapsing
                        document.querySelectorAll('.section-header').forEach(header => {
                            header.addEventListener('click', (e) => {
                                // Don't toggle collapse if clicking on action buttons
                                if (e.target.closest('.section-header-actions')) {
                                    return;
                                }
                                
                                const section = header.parentElement;
                                section.classList.toggle('collapsed');
                            });
                        });
                        
                        // Generate button
                        generateButton.addEventListener('click', () => {
                            vscode.postMessage({ type: 'generateCommit' });
                        });
                        
                        // Commit button
                        commitButton.addEventListener('click', () => {
                            vscode.postMessage({ 
                                type: 'commit', 
                                value: commitMessage.value 
                            });
                        });
                        
                        // Settings button
                        settingsButton.addEventListener('click', () => {
                            vscode.postMessage({ type: 'showSettings' });
                        });
                        
                        // Stage all changes
                        stageAllButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            vscode.postMessage({ type: 'stageAllChanges' });
                        });
                        
                        // Unstage all changes
                        unstageAllButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            vscode.postMessage({ type: 'unstageAllChanges' });
                        });
                        
                        // Refresh button
                        refreshButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            vscode.postMessage({ type: 'refreshChanges' });
                        });
                        
                        // Commit message input
                        commitMessage.addEventListener('input', () => {
                            commitButton.disabled = !commitMessage.value.trim() || state.staged.length === 0;
                        });
                    }
                    
                    // Event handling from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'repositoryState':
                                updateRepositoryState(message.value);
                                break;
                            case 'generating':
                                showStatus('Generating commit message...', 'status-success');
                                generateButton.disabled = true;
                                generateButton.innerHTML = '<span class="loading-spinner"></span> Generating...';
                                break;
                            case 'successCommitGeneration':
                                showStatus('✅ Commit message generated!', 'status-success');
                                generateButton.disabled = false;
                                generateButton.innerHTML = '<span class="icon">✨</span> Generate Message';
                                commitMessage.value = message.value;
                                commitButton.disabled = !message.value.trim() || state.staged.length === 0;
                                break;
                            case 'error':
                                showStatus('❌ ' + message.value, 'status-error');
                                generateButton.disabled = false;
                                generateButton.innerHTML = '<span class="icon">✨</span> Generate Message';
                                break;
                        }
                    });
                    
                    function updateRepositoryState(newState) {
                        if (newState.error) {
                            showStatus('Error: ' + newState.error, 'status-error');
                            return;
                        }
                        
                        state = newState;
                        
                        // Update branch info
                        branchInfo.textContent = state.branch ? \`On: \${state.branch}\` : '';
                        
                        // Update unstaged changes
                        const unstagedFiles = [...state.unstaged, ...state.untracked];
                        changesBadge.textContent = unstagedFiles.length;
                        renderFileList(changesList, unstagedFiles, 'unstaged');
                        
                        // Update staged changes
                        stagedBadge.textContent = state.staged.length;
                        renderFileList(stagedList, state.staged, 'staged');
                        
                        // Update commit message
                        if (state.commitMessage && !commitMessage.value) {
                            commitMessage.value = state.commitMessage;
                        }
                        
                        // Update buttons
                        commitButton.disabled = !commitMessage.value.trim() || state.staged.length === 0;
                        generateButton.disabled = state.staged.length === 0 || state.isGenerating;
                        
                        if (state.isGenerating) {
                            generateButton.innerHTML = '<span class="loading-spinner"></span> Generating...';
                        } else {
                            generateButton.innerHTML = '<span class="icon">✨</span> Generate Message';
                        }
                    }
                    
                    function renderFileList(listElement, files, type) {
                        listElement.innerHTML = '';
                        
                        if (files.length === 0) {
                            const emptyItem = document.createElement('li');
                            emptyItem.className = 'empty-state';
                            emptyItem.innerHTML = \`
                                <div>No \${type === 'unstaged' ? 'changes' : 'staged changes'}</div>
                            \`;
                            listElement.appendChild(emptyItem);
                            return;
                        }
                        
                        files.forEach(file => {
                            const item = document.createElement('li');
                            item.className = 'file-item';
                            
                            // File icon based on status
                            let fileIcon = '📄';
                            if (file.status === 'D') fileIcon = '🗑️';
                            if (file.status === 'A') fileIcon = '📄';
                            if (file.status === 'M') fileIcon = '📄';
                            
                            // Get file path for display
                            const displayPath = file.folderPath ? \`\${file.folderPath}\${file.fileName}\` : file.fileName;
                            
                            // Create item content
                            item.innerHTML = \`
                                <div class="file-icon">\${fileIcon}</div>
                                <div class="file-path" title="\${displayPath}">\${displayPath}</div>
                                <div class="file-status-badge">\${file.statusCode}</div>
                                <div class="file-actions">
                                    \${type === 'unstaged' ? 
                                        '<span class="file-action file-stage" title="Stage Changes">+</span>' :
                                        '<span class="file-action file-unstage" title="Unstage Changes">-</span>'
                                    }
                                </div>
                            \`;
                            
                            // Add event listeners for clicking on file (view diff)
                            item.addEventListener('click', () => {
                                vscode.postMessage({ 
                                    type: 'openDiff', 
                                    value: file.uri 
                                });
                            });
                            
                            // Add event listeners for action buttons
                            if (type === 'unstaged' && item.querySelector('.file-stage')) {
                                item.querySelector('.file-stage').addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    vscode.postMessage({ 
                                        type: 'stageFile', 
                                        value: file.uri 
                                    });
                                });
                            } else if (item.querySelector('.file-unstage')) {
                                item.querySelector('.file-unstage').addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    vscode.postMessage({ 
                                        type: 'unstageFile', 
                                        value: file.uri 
                                    });
                                });
                            }
                            
                            listElement.appendChild(item);
                        });
                    }
                    
                    function showStatus(message, className) {
                        statusMessage.textContent = message;
                        statusMessage.className = 'status-message ' + className;
                        statusMessage.style.display = 'block';
                        
                        // Hide message after 5 seconds
                        setTimeout(() => {
                            statusMessage.style.display = 'none';
                        }, 5000);
                    }
                </script>
            </body>
            </html>`
   }
}

// Helper function to create Git URI for diff
function toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
   return uri.with({
      scheme: 'git',
      query: JSON.stringify({
         path: uri.fsPath,
         ref: ref
      })
   })
}
