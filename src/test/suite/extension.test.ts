import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Extension Test Suite', () => {
   vscode.window.showInformationMessage('Iniciando os testes.')

   // Função auxiliar para esperar um tempo determinado
   const sleep = (ms: number): Promise<void> => 
      new Promise(resolve => setTimeout(resolve, ms))

   test('Extension deve estar ativada', async function() {
      this.timeout(10000) // Aumentando o timeout para 10 segundos
      
      // Aguardar um momento para a extensão ativar
      await sleep(2000)
      
      const extension = vscode.extensions.getExtension(
         'rafaeelricco.commit-ai-generator'
      )
      
      assert.ok(extension, 'Extensão não foi encontrada')
      
      // Garantir que a extensão está ativada ou ativá-la
      if (!extension.isActive) {
         await extension.activate()
      }
      
      assert.strictEqual(extension.isActive, true, 'Extensão não foi ativada')
   })

   // Exemplo de teste para verificar se o comando está registrado
   test('Comando "commit_ai.generateCommit" deve estar registrado', async function() {
      this.timeout(5000) // Aumentando o timeout para 5 segundos
      
      // Esperar um pouco para garantir que os comandos foram registrados
      await sleep(1000)
      
      const commands = await vscode.commands.getCommands()
      assert.ok(commands.includes('commit_ai.generateCommit'), 
               'Comando commit_ai.generateCommit não foi registrado')
   })

   // Adicione mais testes específicos para suas funcionalidades
})
