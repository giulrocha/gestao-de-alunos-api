import request from 'supertest';
import app from '../../src/app.js';

function formatarRespostaLogin(resposta) {
  const token = resposta.body?.token || '';
  const resultado = new String(token);
  resultado.token = token;
  resultado.status = resposta.status;
  resultado.body = resposta.body;
  resultado.usuario = resposta.body?.usuario;
  resultado.resposta = resposta;
  return resultado;
}

/**
 * Realiza o login como administrador.
 * @param {Object} [credenciaisCustomizadas] - Credenciais opcionais para override.
 * @returns {Promise<String & { token: string, usuario: Object, status: number, body: Object, resposta: Object }>}
 */
export async function loginAdmin(credenciaisCustomizadas = {}) {
  const credenciais = {
    email: process.env.ADMIN_EMAIL || 'admin@escola.com',
    senha: process.env.ADMIN_SENHA || 'admin123',
    ...credenciaisCustomizadas,
  };

  const resposta = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send(credenciais);

  return formatarRespostaLogin(resposta);
}

/**
 * Realiza o login como usuário / aluno.
 * @param {Object} credenciais - Objeto contendo { email, senha }.
 * @returns {Promise<String & { token: string, usuario: Object, status: number, body: Object, resposta: Object }>}
 */
export async function loginUsuario(credenciais) {
  const resposta = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send(credenciais);

  return formatarRespostaLogin(resposta);
}

// Alias para maior clareza e flexibilidade
export const loginAluno = loginUsuario;

/**
 * Helper utilitário para obter apenas a string do token.
 * @param {string} email 
 * @param {string} senha 
 * @returns {Promise<string>}
 */
export async function getToken(email, senha) {
  const resultado = await loginUsuario({ email, senha });
  return resultado.token;
}

export default {
  loginAdmin,
  loginUsuario,
  loginAluno,
  getToken,
};
