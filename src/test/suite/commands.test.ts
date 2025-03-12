import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Commands Test Suite', () => {
   // Função auxiliar para esperar um tempo determinado
   const sleep = (ms: number): Promise<void> => 
      new Promise(resolve => setTimeout(resolve, ms))

   // Setup e teardown
   setup(async function() {
      // Configuração antes de cada teste
      this.timeout(10000) // Aumentando o timeout para 10 segundos
      
      // Garantir que a extensão está ativada
      const extension = vscode.extensions.getExtension(
         'rafaeelricco.commit-ai-generator'
      )
      
      if (extension && !extension.isActive) {
         await extension.activate()
      }
      
      // Esperar um momento para a extensão inicializar completamente
      await sleep(1000)
   })

   teardown(() => {
      // Limpeza após cada teste
   })

   test('O comando commit_ai.generateCommit deve estar registrado', async function() {
      this.timeout(5000) // Aumentando o timeout para 5 segundos
      
      const commands = await vscode.commands.getCommands()
      assert.strictEqual(
         commands.includes('commit_ai.generateCommit'),
         true,
         'O comando commit_ai.generateCommit deve estar registrado'
      )
   })

   // Este teste só funcionará depois que você instalar sinon
   // e adaptar para sua implementação real
   test.skip('Teste de geração de commit (desativado)', async () => {
      // Para implementar este teste, você precisará:
      // 1. Instalar sinon: npm install --save-dev sinon @types/sinon
      // 2. Exportar suas funções no arquivo commands.ts
      // 3. Descomentar o código abaixo e adaptá-lo
      /*
    // Mock da API
    const apiStub = sinon.stub().resolves({
      message: 'feat: adiciona feature de geração de commits'
    });
    
    // Chamar sua função real aqui
    // const result = await generateCommitMessage(...);
    
    // assert.strictEqual(result, 'feat: adiciona feature de geração de commits');
    */
   })
})
