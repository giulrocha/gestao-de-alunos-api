import fs from 'node:fs';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Aluno from '../src/models/aluno.model.js';
import Matricula from '../src/models/matricula.model.js';
import Trabalho from '../src/models/trabalho.model.js';
import { loginAdmin, loginUsuario } from './helpers/auth.helper.js';

// Carregamento dos dados de teste a partir do arquivo JSON (Data-Driven Testing)
const dadosTestePath = new URL('./data/alunos-trabalhos.json', import.meta.url);
const dadosTeste = JSON.parse(fs.readFileSync(dadosTestePath, 'utf8'));

describe('Fluxo Completo de Gestão Escolar (Data-Driven Testing)', () => {
  before(async () => {
    // Garante que o banco está conectado caso os testes rodem isoladamente
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gestao-de-alunos';
      await mongoose.connect(uri);
    }
  });

  dadosTeste.cenarios.forEach((cenario) => {
    describe(`Cenário: ${cenario.descricao}`, () => {
      let adminToken;
      let alunoCadastrado;
      let alunoToken;
      let trabalhoRegistrado;

      before(async () => {
        // Limpa possíveis resquícios do aluno antes de iniciar o cenário
        const alunoExistente = await Aluno.findOne({
          $or: [{ email: cenario.aluno.email }, { matricula: cenario.aluno.matricula }],
        });

        if (alunoExistente) {
          await Trabalho.deleteMany({ alunoId: alunoExistente.id });
          await Matricula.deleteMany({ alunoId: alunoExistente.id });
          await Aluno.deleteOne({ _id: alunoExistente.id });
        }
      });

      after(async () => {
        // Limpeza dos dados criados após a execução do cenário
        if (alunoCadastrado?.id) {
          await Trabalho.deleteMany({ alunoId: alunoCadastrado.id });
          await Matricula.deleteMany({ alunoId: alunoCadastrado.id });
          await Aluno.deleteOne({ _id: alunoCadastrado.id });
        }
      });

      it('1. Deve logar como administrador utilizando o helper loginAdmin', async () => {
        const loginRes = await loginAdmin(dadosTeste.admin);

        expect(loginRes.status).to.equal(200);
        expect(loginRes.token).to.be.a('string').and.not.be.empty;
        expect(loginRes.usuario).to.be.an('object');
        expect(loginRes.usuario.role).to.equal('admin');

        adminToken = loginRes.token;
      });

      it('2. Deve cadastrar um novo aluno autenticado como administrador', async () => {
        expect(adminToken, 'Admin precisa estar autenticado').to.be.ok;

        const resposta = await request(app)
          .post('/api/admin/alunos')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(cenario.aluno);

        expect(resposta.status).to.equal(201);
        expect(resposta.body).to.have.property('id');
        expect(resposta.body.nome).to.equal(cenario.aluno.nome);
        expect(resposta.body.email).to.equal(cenario.aluno.email);
        expect(resposta.body.matricula).to.equal(cenario.aluno.matricula);
        expect(resposta.body.role).to.equal('aluno');
        expect(resposta.body).to.not.have.property('senha');

        alunoCadastrado = resposta.body;
      });

      it('3. Deve matricular o aluno na disciplina para permitir envio de trabalhos', async () => {
        expect(alunoCadastrado, 'Aluno precisa ter sido cadastrado').to.be.ok;

        const resposta = await request(app)
          .post(`/api/admin/disciplinas/${cenario.disciplinaId}/matriculas`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ alunoId: alunoCadastrado.id });

        expect(resposta.status).to.equal(201);
        expect(resposta.body).to.have.property('id');
        expect(resposta.body.alunoId).to.equal(alunoCadastrado.id);
        expect(resposta.body.disciplinaId).to.equal(cenario.disciplinaId);
      });

      it('4. Deve logar como o aluno recém-cadastrado utilizando o helper loginUsuario', async () => {
        const loginRes = await loginUsuario({
          email: cenario.aluno.email,
          senha: cenario.aluno.senha,
        });

        expect(loginRes.status).to.equal(200);
        expect(loginRes.token).to.be.a('string').and.not.be.empty;
        expect(loginRes.usuario).to.be.an('object');
        expect(loginRes.usuario.email).to.equal(cenario.aluno.email);
        expect(loginRes.usuario.role).to.equal('aluno');

        alunoToken = loginRes.token;
      });

      it('5. Deve registrar a entrega de um trabalho como o aluno autenticado', async () => {
        expect(alunoToken, 'Aluno precisa estar autenticado').to.be.ok;

        const resposta = await request(app)
          .post(`/api/alunos/${alunoCadastrado.id}/trabalhos`)
          .set('Authorization', `Bearer ${alunoToken}`)
          .send({
            disciplinaId: cenario.disciplinaId,
            titulo: cenario.trabalho.titulo,
            descricao: cenario.trabalho.descricao,
          });

        expect(resposta.status).to.equal(201);
        expect(resposta.body).to.have.property('id');
        expect(resposta.body.alunoId).to.equal(alunoCadastrado.id);
        expect(resposta.body.disciplinaId).to.equal(cenario.disciplinaId);
        expect(resposta.body.titulo).to.equal(cenario.trabalho.titulo);
        expect(resposta.body.descricao).to.equal(cenario.trabalho.descricao);
        expect(resposta.body.status).to.equal('entregue');

        trabalhoRegistrado = resposta.body;
      });
    });
  });
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
