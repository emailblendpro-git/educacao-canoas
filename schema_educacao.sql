-- ============================================================
-- Schema: Educação Canoas (Supabase / PostgreSQL)
-- Extraído do banco em 2026-07-06
-- 11 tabelas do schema public
-- ============================================================

-- ============================================================
-- Tabela: escolas
-- ============================================================
CREATE TABLE public.escolas (
    id           SERIAL PRIMARY KEY,
    nome         VARCHAR(100) NOT NULL,
    turno_manha  BOOLEAN DEFAULT false,
    turno_tarde  BOOLEAN DEFAULT false,
    turno_noite  BOOLEAN DEFAULT false,
    possui_eja   BOOLEAN DEFAULT false,
    ativo        BOOLEAN DEFAULT true
);

-- ============================================================
-- Tabela: cargos_funcoes
-- ============================================================
CREATE TABLE public.cargos_funcoes (
    id     SERIAL PRIMARY KEY,
    nome   VARCHAR(50) NOT NULL UNIQUE,
    ativo  BOOLEAN DEFAULT true
);

-- ============================================================
-- Tabela: disciplinas
-- ============================================================
CREATE TABLE public.disciplinas (
    id     SERIAL PRIMARY KEY,
    nome   VARCHAR(50) NOT NULL,
    sigla  VARCHAR(10) NOT NULL UNIQUE,
    ativo  BOOLEAN DEFAULT true
);

-- ============================================================
-- Tabela: usuarios
-- ============================================================
CREATE TABLE public.usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    login       VARCHAR(50) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    perfil      VARCHAR(20) NOT NULL
                 CHECK (perfil IN ('admin', 'secretaria_central', 'diretor', 'visualizacao')),
    escola_id   INTEGER REFERENCES public.escolas(id),
    ativo       BOOLEAN DEFAULT true,
    criado_em   TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Tabela: professores
-- ============================================================
CREATE TABLE public.professores (
    id                        SERIAL PRIMARY KEY,
    matricula                 VARCHAR(20) NOT NULL UNIQUE,
    nome                      VARCHAR(100) NOT NULL,
    area_concurso             VARCHAR(50),
    cargo_funcao_id           INTEGER REFERENCES public.cargos_funcoes(id),
    disciplina_principal_id   INTEGER REFERENCES public.disciplinas(id),
    carga_horaria_contratual  INTEGER NOT NULL
                               CHECK (carga_horaria_contratual IN (10, 20, 40)),
    tipo_vinculo              VARCHAR(15) NOT NULL DEFAULT 'concursado'
                               CHECK (tipo_vinculo IN ('concursado', 'contratado')),
    data_fim_contrato         DATE,
    status                    VARCHAR(20) NOT NULL DEFAULT 'ativo'
                               CHECK (status IN ('ativo', 'afastado', 'readaptado', 'reducao_de_carga', 'excedente', 'a_disposicao')),
    data_inicio_afastamento   DATE,
    data_fim_afastamento      DATE,
    ano_letivo                INTEGER NOT NULL DEFAULT 2026,
    criado_em                 TIMESTAMP DEFAULT now(),
    atualizado_em             TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Tabela: turmas
-- ============================================================
CREATE TABLE public.turmas (
    id             SERIAL PRIMARY KEY,
    escola_id      INTEGER NOT NULL REFERENCES public.escolas(id),
    ano_escolar    VARCHAR(15) NOT NULL
                    CHECK (ano_escolar IN ('1','2','3','4','5','6','7','8','9',
                                           'eja_alfa','eja_pos','eja_alfa_pos',
                                           'eja_m1','eja_m2','eja_m1_m2','eja_m3','eja_m4')),
    turno          VARCHAR(10) NOT NULL
                    CHECK (turno IN ('manha', 'tarde', 'noite')),
    identificador  VARCHAR(5) NOT NULL,
    ativo          BOOLEAN DEFAULT true,
    ano_letivo     INTEGER NOT NULL DEFAULT 2026,
    criado_em      TIMESTAMP DEFAULT now(),
    UNIQUE (escola_id, ano_escolar, turno, identificador, ano_letivo)
);

-- ============================================================
-- Tabela: lotacoes
-- ============================================================
CREATE TABLE public.lotacoes (
    id             SERIAL PRIMARY KEY,
    professor_id   INTEGER NOT NULL REFERENCES public.professores(id),
    escola_id      INTEGER NOT NULL REFERENCES public.escolas(id),
    carga_horaria  INTEGER NOT NULL
                    CHECK (carga_horaria IN (10, 20, 40)),
    tipo           VARCHAR(15) NOT NULL
                    CHECK (tipo IN ('principal', 'cch', 'desdobro')),
    turno          VARCHAR(10) NOT NULL
                    CHECK (turno IN ('manha', 'tarde', 'noite', 'integral')),
    ativo          BOOLEAN DEFAULT true,
    ano_letivo     INTEGER NOT NULL DEFAULT 2026,
    criado_em      TIMESTAMP DEFAULT now(),
    atualizado_em  TIMESTAMP DEFAULT now(),
    -- 'desdobro' é um período extra (10h ou 20h) somado ao vínculo principal,
    -- às vezes no mesmo turno do vínculo principal -- por isso "tipo" também
    -- entra na chave única (permite 2 linhas para o mesmo professor+turno,
    -- uma 'principal' e uma 'desdobro').
    UNIQUE (professor_id, turno, tipo, ano_letivo)
);

-- ============================================================
-- Tabela: alocacoes
-- ============================================================
CREATE TABLE public.alocacoes (
    id              SERIAL PRIMARY KEY,
    professor_id    INTEGER NOT NULL REFERENCES public.professores(id),
    turma_id        INTEGER NOT NULL REFERENCES public.turmas(id),
    disciplina_id   INTEGER NOT NULL REFERENCES public.disciplinas(id),
    periodos        INTEGER NOT NULL CHECK (periodos > 0),
    tipo            VARCHAR(15) NOT NULL DEFAULT 'regular'
                     CHECK (tipo IN ('regular', 'temporaria')),
    motivo          VARCHAR(20)
                     CHECK (motivo IN ('vaga_aberta', 'afastamento')),
    data_inicio     DATE,
    data_fim        DATE,
    ativo           BOOLEAN DEFAULT true,
    ano_letivo      INTEGER NOT NULL DEFAULT 2026,
    criado_em       TIMESTAMP DEFAULT now(),
    atualizado_em   TIMESTAMP DEFAULT now(),
    UNIQUE (turma_id, disciplina_id, ano_letivo)
);

-- ============================================================
-- Tabela: matriz_curricular_global
-- ============================================================
CREATE TABLE public.matriz_curricular_global (
    id                SERIAL PRIMARY KEY,
    etapa             VARCHAR(10) NOT NULL
                       CHECK (etapa IN ('iniciais', 'finais', 'eja')),
    ano_escolar       VARCHAR(15) NOT NULL,
    disciplina_id     INTEGER NOT NULL REFERENCES public.disciplinas(id),
    periodos_semana   INTEGER NOT NULL CHECK (periodos_semana > 0),
    UNIQUE (ano_escolar, disciplina_id)
);

-- ============================================================
-- Tabela: matriz_projetos_escola
-- ============================================================
CREATE TABLE public.matriz_projetos_escola (
    id                SERIAL PRIMARY KEY,
    escola_id         INTEGER NOT NULL REFERENCES public.escolas(id),
    ano_escolar       VARCHAR(15) NOT NULL,
    disciplina_id     INTEGER NOT NULL REFERENCES public.disciplinas(id),
    periodos_semana   INTEGER NOT NULL CHECK (periodos_semana >= 1),
    ano_letivo        INTEGER NOT NULL DEFAULT 2026,
    atualizado_em     TIMESTAMP DEFAULT now(),
    atualizado_por    INTEGER REFERENCES public.usuarios(id),
    UNIQUE (escola_id, ano_escolar, disciplina_id, ano_letivo)
);

-- ============================================================
-- Tabela: log_auditoria
-- ============================================================
CREATE TABLE public.log_auditoria (
    id               SERIAL PRIMARY KEY,
    usuario_id       INTEGER NOT NULL REFERENCES public.usuarios(id),
    acao             VARCHAR(10) NOT NULL
                      CHECK (acao IN ('criou', 'editou', 'removeu')),
    tabela           VARCHAR(50) NOT NULL,
    registro_id      INTEGER NOT NULL,
    dados_anterior   JSONB,
    criado_em        TIMESTAMP DEFAULT now()
);

-- ============================================================
-- Tabela: pendencias
-- Pendências geradas pela importação de planilhas (tools/parse-planilha.js),
-- para cada escola revisar e corrigir direto no sistema.
-- ============================================================
CREATE TABLE public.pendencias (
    id             SERIAL PRIMARY KEY,
    escola_id      INTEGER NOT NULL REFERENCES public.escolas(id),
    tipo           VARCHAR(50) NOT NULL,
    chave_natural  VARCHAR(255) NOT NULL,
    dados          JSONB NOT NULL,
    status         VARCHAR(15) NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta', 'resolvida')),
    observacao     TEXT,
    ano_letivo     INTEGER NOT NULL DEFAULT 2026,
    criado_em      TIMESTAMP DEFAULT now(),
    resolvido_em   TIMESTAMP,
    resolvido_por  INTEGER REFERENCES public.usuarios(id),
    UNIQUE (escola_id, tipo, chave_natural, ano_letivo)
);
