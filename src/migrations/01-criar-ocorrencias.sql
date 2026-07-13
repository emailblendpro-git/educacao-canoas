-- Criar tabela de observações de professores
CREATE TABLE IF NOT EXISTS observacoes_professores (
  id SERIAL PRIMARY KEY,
  professor_id INTEGER NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  escola_id INTEGER NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  texto VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'aberta',
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  encerrado_em TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_observacoes_professor_id ON observacoes_professores(professor_id);
CREATE INDEX IF NOT EXISTS idx_observacoes_escola_id ON observacoes_professores(escola_id);
CREATE INDEX IF NOT EXISTS idx_observacoes_status ON observacoes_professores(status);
CREATE INDEX IF NOT EXISTS idx_observacoes_data ON observacoes_professores(data DESC);
