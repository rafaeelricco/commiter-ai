import * as path from 'path'
import * as vscode from 'vscode'

import { generateCommitMessage } from '@/extension/api'
import { _getHtmlForWebview } from '@/utils/html-web-view'

interface GitChange {
   uri: vscode.Uri
   status: string
   relativePath?: string
}

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

interface GitAPI {
   repositories: GitRepository[]
   onDidChangeState?: (callback: () => void) => vscode.Disposable
   onDidChangeRepository?: (callback: () => void) => vscode.Disposable
}

export class CommitViewProvider implements vscode.WebviewViewProvider {
   public static readonly viewType = 'commiterAiView'

   private _view?: vscode.WebviewView
   private _gitApi?: GitAPI
   private _isGenerating: boolean = false
   private _disposables: vscode.Disposable[] = []
   private _debounceTimer: NodeJS.Timeout | null = null
   private _diffCache = new Map<
      string,
      { timestamp: number; content: string }
   >()
   private _repositoryWatcher: vscode.Disposable | NodeJS.Timeout | undefined

   constructor(private readonly _extensionUri: vscode.Uri) {}

   public resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
   ) {
      this._view = webviewView

      webviewView.webview.options = {
         enableScripts: true,
         localResourceRoots: [this._extensionUri]
      }

      webviewView.webview.html = _getHtmlForWebview(webviewView.webview)

      this._startRepositoryStateTracking()

      webviewView.webview.onDidReceiveMessage(async (data) => {
         switch (data.type) {
            case 'getRepositoryState': {
               await this._debouncedSendRepositoryState()
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
               await this._debouncedSendRepositoryState()
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

      webviewView.onDidDispose(() => {
         this._diffCache.clear()
         if (this._repositoryWatcher) {
            if (typeof this._repositoryWatcher === 'number') {
               clearInterval(this._repositoryWatcher)
            } else if ('dispose' in this._repositoryWatcher) {
               this._repositoryWatcher.dispose()
            }
         }
         this._disposables.forEach((d) => d.dispose())
         this._disposables = []
      })
   }

   private _debouncedSendRepositoryState() {
      if (this._debounceTimer) {
         clearTimeout(this._debounceTimer)
      }

      this._debounceTimer = setTimeout(() => {
         this._sendRepositoryState()
         this._debounceTimer = null
      }, 300)
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
      if (!changes.length) return []

      const result = new Array(changes.length)

      for (let i = 0; i < changes.length; i++) {
         const change = changes[i]
         const path = change.uri.path
         const relativePath = change.relativePath || path.split('/').pop()

         const pathParts = relativePath.split('/')
         const fileName = pathParts.pop() || ''
         const folderPath =
            pathParts.length > 0 ? pathParts.join('/') + '/' : ''

         result[i] = {
            fileName,
            folderPath,
            relativePath,
            fullPath: path,
            status: change.status,
            uri: change.uri.toString(),
            statusText: this._getStatusText(change.status),
            statusCode: this._getStatusCode(change.status)
         }
      }

      return result
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
         const fileUri = vscode.Uri.parse(uri)

         await repo.add([fileUri.fsPath])

         this._debouncedSendRepositoryState()
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

         const fileUri = vscode.Uri.parse(uri)

         await repo.revert([fileUri.fsPath])

         this._debouncedSendRepositoryState()
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

         await vscode.commands.executeCommand('git.stageAll')

         this._debouncedSendRepositoryState()
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

         await vscode.commands.executeCommand('git.unstageAll')

         this._debouncedSendRepositoryState()
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
            toGitUri(fileUri, '~'),
            fileUri,
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

            this._debouncedSendRepositoryState()
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

         repo.inputBox.value = ''

         this._view?.webview.postMessage({
            type: 'commitSuccess',
            value: ''
         })

         this._debouncedSendRepositoryState()
         this._diffCache.clear()

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

      this._isGenerating = true
      this._view?.webview.postMessage({ type: 'generating' })
      await this._sendRepositoryState()

      try {
         const diffData = await this._getDiffFormatted(repo, indexChanges)

         if (!diffData) {
            throw new Error('Não foi possível obter os dados do diff.')
         }

         const apiKey = vscode.workspace
            .getConfiguration('commiter_ai')
            .get<string>('api_key')
         if (!apiKey) {
            throw new Error(
               'API Key não configurada. Configure em Settings > Extensions > Commiter Ai.'
            )
         }

         const commitMessage = await generateCommitMessage(diffData)

         repo.inputBox.value = commitMessage

         this._view?.webview.postMessage({
            type: 'successCommitGeneration',
            value: commitMessage
         })

         const soundEnabled = vscode.workspace
            .getConfiguration('commiter_ai')
            .get<boolean>('sound_enabled')
         if (soundEnabled) {
            try {
               const soundPlay = require('sound-play')
               const soundPath = vscode.Uri.file(
                  path.join(this._extensionUri.fsPath, 'assets', 'success.MP3')
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

   private _startRepositoryStateTracking() {
      // Try to use git events first (more efficient)
      this._ensureGitApi().then((gitApi) => {
         if (gitApi) {
            const onDidChangeRepository =
               gitApi.onDidChangeState || gitApi.onDidChangeRepository
            if (onDidChangeRepository) {
               const disposable = onDidChangeRepository(() => {
                  if (this._view && this._view.visible) {
                     this._debouncedSendRepositoryState()
                  }
               })
               this._disposables.push(disposable)
               this._repositoryWatcher = disposable
               return
            }
         }

         this._repositoryWatcher = setInterval(() => {
            if (this._view && this._view.visible) {
               this._debouncedSendRepositoryState()
            }
         }, 5000)
      })
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
      const MAX_FILE_SIZE = 500 * 1024
      const CACHE_TTL = 30 * 1000
      const now = Date.now()

      let diffOutput = 'STAGED CHANGES SUMMARY:\n\n'

      diffOutput += 'Files changed:\n'
      for (const change of indexChanges) {
         const filePath = change.uri.path.split('/').pop() || change.uri.path
         diffOutput += change.status + ' ' + filePath + '\n'
      }

      diffOutput += '\n--- DETAILED CHANGES ---\n\n'

      for (const change of indexChanges) {
         const filePath = change.uri.path.split('/').pop() || change.uri.path
         const cacheKey = `${change.uri.toString()}_${change.status}`

         const cachedDiff = this._diffCache.get(cacheKey)
         if (cachedDiff && now - cachedDiff.timestamp < CACHE_TTL) {
            diffOutput += cachedDiff.content
            continue
         }

         let fileDiffOutput = 'File: ' + filePath + ' (' + change.status + ')\n'

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

         fileDiffOutput += 'Status: ' + statusDescription + '\n'

         try {
            if (change.status !== 'D') {
               try {
                  const fileContent = await repo.show(change.uri.toString())

                  if (typeof fileContent === 'string') {
                     const fileSize = fileContent.length

                     if (fileSize > MAX_FILE_SIZE) {
                        fileDiffOutput += `\nLarge file detected (${Math.round(fileSize / 1024)}KB).\n`
                        fileDiffOutput += 'Preview of first 15 lines:\n'
                        const firstLines = fileContent.split('\n', 15)
                        fileDiffOutput +=
                           firstLines.map((line) => '+ ' + line).join('\n') +
                           '\n'
                        fileDiffOutput += `\n... (${fileSize} bytes total, preview truncated) ...\n`
                     } else {
                        const lines = fileContent.split('\n')
                        const previewLines = lines.slice(
                           0,
                           Math.min(15, lines.length)
                        )

                        fileDiffOutput += '\nPreview content:\n'
                        fileDiffOutput +=
                           previewLines.map((line) => '+ ' + line).join('\n') +
                           '\n'

                        if (lines.length > 15) {
                           fileDiffOutput +=
                              '\n... (' +
                              (lines.length - 15) +
                              ' more lines) ...\n'
                        }
                     }
                  } else {
                     fileDiffOutput += 'Arquivo binário ou não suportado.\n'
                  }
               } catch (contentError) {
                  fileDiffOutput +=
                     'Não foi possível obter o conteúdo: ' +
                     (contentError instanceof Error
                        ? contentError.message
                        : String(contentError)) +
                     '\n'
               }
            } else {
               fileDiffOutput += '\nFile was deleted\n'
            }

            fileDiffOutput += '\n----------------------------------------\n\n'

            this._diffCache.set(cacheKey, {
               timestamp: now,
               content: fileDiffOutput
            })

            diffOutput += fileDiffOutput
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
}

function toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
   return uri.with({
      scheme: 'git',
      query: JSON.stringify({
         path: uri.fsPath,
         ref: ref
      })
   })
}
