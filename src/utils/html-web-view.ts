import * as vscode from 'vscode'

function getNonce() {
   let text = ''
   const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
   for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
   }
   return text
}

function _getWebviewStyles(): string {
   return `
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
       0% {
          transform: rotate(0deg);
       }
       100% {
          transform: rotate(360deg);
       }
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
    }`
}

function _getWebviewScript(): string {
   try {
      return `
          const vscode = acquireVsCodeApi();

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
          
          let state = {
              branch: '',
              staged: [],
              unstaged: [],
              untracked: []
          };
          
          initializeUI();
          vscode.postMessage({ type: 'getRepositoryState' });
          
          function initializeUI() {
              document.querySelectorAll('.section-header').forEach(header => {
                  header.addEventListener('click', (e) => {
                      if (e.target.closest('.section-header-actions')) {
                          return;
                      }
                      
                      const section = header.parentElement;
                      section.classList.toggle('collapsed');
                  });
              });
              
              generateButton.addEventListener('click', () => {
                  vscode.postMessage({ type: 'generateCommit' });
              });
              
              commitButton.addEventListener('click', () => {
                  vscode.postMessage({ 
                      type: 'commit', 
                      value: commitMessage.value 
                  });
              });
              
              settingsButton.addEventListener('click', () => {
                  vscode.postMessage({ type: 'showSettings' });
              });
              
              stageAllButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  vscode.postMessage({ type: 'stageAllChanges' });
              });
              
              unstageAllButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  vscode.postMessage({ type: 'unstageAllChanges' });
              });

              refreshButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  vscode.postMessage({ type: 'refreshChanges' });
              });
              
              commitMessage.addEventListener('input', () => {
                  commitButton.disabled = !commitMessage.value.trim() || state.staged.length === 0;
              });
          }
          
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
                  case 'commitSuccess':
                      showStatus('Changes committed successfully!', 'status-success');
                      commitMessage.value = '';
                      commitButton.disabled = true;
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
       `
   } catch (error) {
      console.error('Error reading script file:', error)
      return ''
   }
}

export function _getHtmlForWebview(webview: vscode.Webview): string {
   const nonce = getNonce()
   const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};`
   const cssContent = _getWebviewStyles()

   return `
     <!DOCTYPE html>
     <html lang="en">
     <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commiter AI</title>
        <style>
           ${cssContent}
        </style>
     </head>
     <body>
        <div class="container">
           <header>
              <h1>
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
           ${_getWebviewScript()}
        </script>
     </body>
     </html>
     `
}
