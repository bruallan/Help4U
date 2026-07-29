-- 1. Banco de Dados (Supabase) - Script SQL para elasticity_tests

CREATE TYPE test_status AS ENUM (
  'waiting_A', 
  'running_B', 
  'validating_opt', 
  'finished', 
  'recalculating'
);

CREATE TABLE elasticity_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id varchar NOT NULL,
  status test_status NOT NULL DEFAULT 'waiting_A',
  
  -- Baseline (Fase A)
  price_a numeric,
  vol_a numeric,
  margin_a numeric,
  date_a_start timestamp,
  date_a_end timestamp,
  
  -- Intervenção (Fase B)
  price_b numeric,
  vol_b numeric,
  margin_b numeric,
  date_b_start timestamp,
  date_b_end timestamp,
  
  -- Custos e Elasticidade
  c_total numeric,
  elasticity_coef numeric,
  
  -- Validação (Fase 3) e Resultados
  price_opt numeric,
  expected_margin_opt numeric,
  actual_margin_opt numeric,
  error_percentage numeric,
  
  iteration_count int DEFAULT 1,
  
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_elasticity_tests_product ON elasticity_tests(product_id);
CREATE INDEX idx_elasticity_tests_status ON elasticity_tests(status);
