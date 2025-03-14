import * as fs from 'fs'
import * as path from 'path'

import { runTests } from '@vscode/test-electron'

async function main() {
   try {
      // The folder containing the Extension Manifest package.json
      const extensionDevelopmentPath = path.resolve(__dirname, '../../')

      // O workspace que deve ser aberto no VSCode de teste (o próprio projeto)
      const workspacePath = extensionDevelopmentPath

      // The path to the extension test script
      const extensionTestsPath = path.resolve(
         __dirname,
         '../../out/test/suite/index'
      )

      console.log(`Extension development path: ${extensionDevelopmentPath}`)
      console.log(`Extension tests path: ${extensionTestsPath}`)
      console.log(`Workspace path: ${workspacePath}`)

      // Verify the compiled test file exists
      if (!fs.existsSync(extensionTestsPath + '.js')) {
         console.error(`ERROR: Test file not found: ${extensionTestsPath}.js`)
         console.log('Available files in directory:')
         const dir = path.dirname(extensionTestsPath)
         if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir)
            console.log(files)

            // If index.js doesn't exist but index.ts does, we need to compile it
            if (files.includes('index.ts') && !files.includes('index.js')) {
               console.log(
                  'Found index.ts but not index.js. Please ensure TypeScript compilation is working properly.'
               )
            }
         } else {
            console.log(`Directory ${dir} does not exist!`)
         }
         process.exit(1)
      }

      // Download VS Code, unzip it and run the integration test
      await runTests({
         extensionDevelopmentPath,
         extensionTestsPath,
         // Use these launch args to speed up the tests and keep VSCode open
         launchArgs: [
            // Passe o caminho do workspace como primeiro argumento
            workspacePath,
            // Habilite a funcionalidade do Git
            '--enable-proposed-api=vscode.git',
            // Permitir extensões necessárias (incluindo Git)
            '--extensions-dir=.vscode-test/extensions',
            // Habilitar todas as extensões integradas
            // Não desabilitar extensões
            '--disable-extensions=false',
            // Parâmetros para melhorar a experiência
            '--skip-welcome',
            '--skip-release-notes'
         ]
      })
   } catch (err) {
      console.error('Failed to run tests', err)

      // Add more helpful error message for the specific error
      if (
         err instanceof Error &&
         err.message &&
         err.message.includes(
            'Running extension tests from the command line is currently only supported if no other instance of Code is running'
         )
      ) {
         console.error(
            '\n\x1b[31mERROR: Please close all instances of VS Code before running tests!\x1b[0m'
         )
      }

      process.exit(1)
   }
}

// Add console info about the test requirements
console.log(
   '\n\x1b[33mIMPORTANT: Please ensure all VS Code windows are closed before running tests!\x1b[0m'
)
console.log(
   '\nThe testing framework will launch its own instance of VS Code with the commiter-ai project\n'
)

main()
