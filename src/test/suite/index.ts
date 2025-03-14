import { glob } from 'glob'
import Mocha from 'mocha'
import * as path from 'path'
import * as vscode from 'vscode'

// Função para tratar erros globalmente, evitando terminação abrupta
process.on('uncaughtException', (error) => {
   console.error('Erro não capturado no processo de teste:')
   console.error(error)
   // Não terminamos o processo para manter o VSCode aberto
})

export async function run(): Promise<void> {
   // Create the mocha test
   const mocha = new Mocha({
      ui: 'tdd',
      color: true,
      // Set a very long timeout to keep the test process alive
      timeout: 99999999,
      reporter: 'spec'
   })

   const testsRoot = path.resolve(__dirname, '.')

   try {
      // Use the glob pattern to find tests in the current directory
      // glob v11 returns strings directly, not a promise with glob method
      const files = await glob('**/*.test.js', { cwd: testsRoot })

      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

      console.log('\n======================================================')
      console.log(
         'Iniciando testes. O VSCode permanecerá aberto para testes manuais.'
      )
      console.log(
         'Para encerrar os testes e ver os resultados, pressione Ctrl+C no terminal.'
      )
      console.log('======================================================\n')

      // Tenta registrar comandos de abertura de pasta para evitar crashes
      try {
         // Após os testes terminarem, podemos ativar funções adicionais para testes manuais
         vscode.commands.registerCommand(
            'workbench.action.openFolder',
            async (uri) => {
               console.log('Comando de abrir pasta interceptado:', uri)
               // Podemos implementar nossa própria lógica aqui se necessário
               // ou apenas deixar o comando original ser executado
               return vscode.commands.executeCommand(
                  '_workbench.action.openFolder',
                  uri
               )
            }
         )
      } catch (err) {
         console.log(
            'Não foi possível registrar handlers para comandos do VSCode:',
            err
         )
      }

      // Run the mocha test
      return new Promise<void>((resolve, reject) => {
         const runner = mocha.run((failures: number) => {
            if (failures > 0) {
               console.log(`\n❌ ${failures} testes falharam.`)
               console.log(
                  'Você pode continuar testando a extensão manualmente.'
               )
               console.log('Para encerrar, pressione Ctrl+C no terminal.\n')
               // Don't reject to keep VSCode open
            } else {
               console.log('\n✅ Todos os testes passaram!')
               console.log(
                  'Você pode continuar testando a extensão manualmente.'
               )
               console.log('Para encerrar, pressione Ctrl+C no terminal.\n')
               // Don't resolve to keep VSCode open
            }
         })

         // Keep the process open by adding a long-running listener
         process.on('SIGINT', () => {
            console.log('\n\nFinalizando testes por solicitação do usuário...')
            console.log('Resultados dos testes:')
            console.log(`Total: ${runner.total}`)
            console.log(`Passaram: ${runner.total - runner.failures}`)
            console.log(`Falharam: ${runner.failures}`)

            if (runner.failures > 0) {
               reject(new Error(`${runner.failures} testes falharam.`))
            } else {
               resolve()
            }
         })
      })
   } catch (err) {
      console.error('Error running tests:', err)
      // Não lançamos o erro para evitar o término do processo
      return new Promise<void>(() => {
         console.log('Mantendo VSCode aberto para testes manuais...')
         // Nunca resolve esta Promise para manter o processo aberto
      })
   }
}
