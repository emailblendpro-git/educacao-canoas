-- Criar tabela de ocorrências de professores
CREATE TABLE IF NOT EXISTS ocorrencias_professores (
  id SERIAL PRIMARY KEY,
  professor_id INTEGER NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  escola_id INTEGER NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) DEFAULT 'geral',
  data_ocorrencia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocorrencias_professor_escola
    UNIQUE (professor_id, escola_id, data_ocorrencia, titulo)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ocorrencias_professor_id ON ocorrencias_professores(professor_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_escola_id ON ocorrencias_professores(escola_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_data ON ocorrencias_professores(data_ocorrencia DESC);
