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

export class CommitViewProvider implements vscode.WebviewViewProvider {
   public static readonly viewType = 'commiterAiView'

   private _view?: vscode.WebviewView
   private _gitApi?: any // Cache Git API
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

      // Get repository state including staged, unstaged, and untracked files
      const state = {
         branch: repo.state.HEAD?.name || '',
         staged: this._formatChangedFiles(repo.state.indexChanges),
         unstaged: this._formatChangedFiles(repo.state.workingTreeChanges),
         untracked: this._formatChangedFiles(repo.state.untrackedChanges),
         commitMessage: repo.inputBox.value,
         isGenerating: this._isGenerating
      }

      this._view?.webview.postMessage({
         type: 'repositoryState',
         value: state
      })
   }

   private _formatChangedFiles(changes: any[] = []) {
      return changes.map((change) => {
         const path = change.uri.path
         const fileName = path.split('/').pop()
         const folderPath = path.substring(0, path.length - fileName.length)

         return {
            fileName,
            folderPath,
            fullPath: path,
            status: change.status,
            uri: change.uri.toString(),
            statusText: this._getStatusText(change.status)
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

   private async _stageFile(uri: string) {
      const gitApi = await this._ensureGitApi()
      if (!gitApi || gitApi.repositories.length === 0) return

      const repo = gitApi.repositories[0]
      await repo.add([vscode.Uri.parse(uri)])
      await this._sendRepositoryState()
   }

   private async _unstageFile(uri: string) {
      const gitApi = await this._ensureGitApi()
      if (!gitApi || gitApi.repositories.length === 0) return

      const repo = gitApi.repositories[0]
      await repo.revert([vscode.Uri.parse(uri)])
      await this._sendRepositoryState()
   }

   private async _openDiff(uri: string) {
      await vscode.commands.executeCommand(
         'vscode.diff',
         vscode.Uri.parse(`${uri}~`),
         vscode.Uri.parse(uri),
         'File Changes'
      )
   }

   private async _discardChanges(uri: string) {
      const result = await vscode.window.showWarningMessage(
         'Are you sure you want to discard all changes to this file?',
         { modal: true },
         'Discard Changes'
      )

      if (result === 'Discard Changes') {
         const gitApi = await this._ensureGitApi()
         if (!gitApi || gitApi.repositories.length === 0) return

         const repo = gitApi.repositories[0]
         await repo.clean([vscode.Uri.parse(uri)])
         await this._sendRepositoryState()
      }
   }

   private async _commitChanges(message: string) {
      if (!message.trim()) {
         vscode.window.showErrorMessage('Commit message cannot be empty')
         return
      }

      const gitApi = await this._ensureGitApi()
      if (!gitApi || gitApi.repositories.length === 0) return

      const repo = gitApi.repositories[0]
      await repo.commit(message)
      await this._sendRepositoryState()

      vscode.window.showInformationMessage('Changes committed successfully!')
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
      repo: any,
      indexChanges: any[]
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
                        --section-gap: 10px;
                        --border-radius: 4px;
                        --animation-duration: 0.25s;
                    }
                    
                    body {
                        padding: 0;
                        margin: 0;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-sideBar-background);
                        font-size: var(--vscode-font-size);
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
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    header h1 {
                        font-size: 14px;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .icon {
                        display: inline-flex;
                        width: 16px;
                        height: 16px;
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
                        padding: var(--section-gap);
                        display: flex;
                        flex-direction: column;
                        gap: var(--section-gap);
                    }
                    
                    .section {
                        background-color: var(--vscode-sideBar-background);
                        border-radius: var(--border-radius);
                    }
                    
                    .section-header {
                        padding: 4px 12px;
                        font-weight: 600;
                        font-size: 13px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        cursor: pointer;
                        user-select: none;
                        color: var(--vscode-sideBarSectionHeader-foreground);
                        background-color: var(--vscode-sideBarSectionHeader-background);
                        border-top-left-radius: var(--border-radius);
                        border-top-right-radius: var(--border-radius);
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
                    }
                    
                    .section-content {
                        overflow: hidden;
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
                        padding: 4px 12px 4px 24px;
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
                        margin-right: 6px;
                        color: var(--vscode-icon-foreground);
                        opacity: 0.7;
                    }
                    
                    .file-status {
                        font-size: 11px;
                        margin-left: auto;
                        opacity: 0.7;
                    }
                    
                    .file-actions {
                        display: none;
                        position: absolute;
                        right: 12px;
                        gap: 8px;
                    }
                    
                    .file-item:hover .file-status {
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
                        gap: 8px;
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
                        padding: 6px 8px;
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
                        padding: 4px 12px;
                        cursor: pointer;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        white-space: nowrap;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        height: 28px;
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
                        height: 100%;
                    }
                    
                    .empty-state-icon {
                        font-size: 24px;
                        margin-bottom: 12px;
                    }
                    
                    .status-message {
                        font-size: 12px;
                        padding: 8px;
                        margin-top: 8px;
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
                        margin-left: 6px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>
                            <span class="icon">✨</span> 
                            Commiter AI
                            <span class="branch-info" id="branch-info"></span>
                        </h1>
                        <span class="icon settings-icon" id="settings-button">⚙️</span>
                    </header>
                    
                    <div class="sections">
                        <div class="section" id="changes-section">
                            <div class="section-header" data-toggle="changes">
                                <span>Changes</span>
                                <span class="badge" id="changes-badge">0</span>
                            </div>
                            <div class="section-content">
                                <ul class="file-list" id="changes-list"></ul>
                            </div>
                        </div>
                        
                        <div class="section" id="staged-section">
                            <div class="section-header" data-toggle="staged">
                                <span>Staged Changes</span>
                                <span class="badge" id="staged-badge">0</span>
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
                            header.addEventListener('click', () => {
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
                                <div class="empty-state-icon">📁</div>
                                <div>No \${type === 'unstaged' ? 'changes' : 'staged changes'} found</div>
                            \`;
                            listElement.appendChild(emptyItem);
                            return;
                        }
                        
                        files.forEach(file => {
                            const item = document.createElement('li');
                            item.className = 'file-item';
                            
                            // Status icon
                            let fileIcon = '📄';
                            if (file.status === 'D') fileIcon = '🗑️';
                            if (file.status === 'A') fileIcon = '🆕';
                            if (file.status === 'M') fileIcon = '📝';
                            
                            // Create item content
                            item.innerHTML = \`
                                <span class="file-icon">\${fileIcon}</span>
                                <span class="file-name">\${file.fileName}</span>
                                <span class="file-status">\${file.statusText}</span>
                                <div class="file-actions">
                                    <span class="file-action file-view" title="View Diff">👁️</span>
                                    \${type === 'unstaged' ? 
                                        '<span class="file-action file-stage" title="Stage File">➕</span>' :
                                        '<span class="file-action file-unstage" title="Unstage File">➖</span>'
                                    }
                                    \${type === 'unstaged' ? 
                                        '<span class="file-action file-discard" title="Discard Changes">🗑️</span>' : ''
                                    }
                                </div>
                            \`;
                            
                            // Add event listeners
                            item.querySelector('.file-view').addEventListener('click', (e) => {
                                e.stopPropagation();
                                vscode.postMessage({ 
                                    type: 'openDiff', 
                                    value: file.uri 
                                });
                            });
                            
                            if (type === 'unstaged') {
                                item.querySelector('.file-stage').addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    vscode.postMessage({ 
                                        type: 'stageFile', 
                                        value: file.uri 
                                    });
                                });
                                
                                if (item.querySelector('.file-discard')) {
                                    item.querySelector('.file-discard').addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        vscode.postMessage({ 
                                            type: 'discardChanges', 
                                            value: file.uri 
                                        });
                                    });
                                }
                            } else {
                                item.querySelector('.file-unstage').addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    vscode.postMessage({ 
                                        type: 'unstageFile', 
                                        value: file.uri 
                                    });
                                });
                            }
                            
                            // Add entire item click to view diff
                            item.addEventListener('click', () => {
                                vscode.postMessage({ 
                                    type: 'openDiff', 
                                    value: file.uri 
                                });
                            });
                            
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
