-- 3. O Motor Matemático (Preço Ótimo) - Supabase RPC

CREATE OR REPLACE FUNCTION calculate_optimal_price(test_uuid UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    test_record RECORD;
    v_a NUMERIC;
    v_b NUMERIC;
    p_a NUMERIC;
    p_b NUMERIC;
    c_tot NUMERIC;
    e_coef NUMERIC;
    p_opt NUMERIC;
    v_proj NUMERIC;
    m_proj NUMERIC;
BEGIN
    -- Obter o registro do teste
    SELECT * INTO test_record FROM elasticity_tests WHERE id = test_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teste não encontrado';
    END IF;

    v_a := test_record.vol_a;
    v_b := test_record.vol_b;
    p_a := test_record.price_a;
    p_b := test_record.price_b;
    c_tot := test_record.c_total;

    -- Proteção contra divisão por zero
    IF v_a = 0 OR p_a = 0 OR p_a = p_b THEN
        RAISE EXCEPTION 'Dados insuficientes ou inválidos para calcular a elasticidade (divisão por zero).';
    END IF;

    -- Passo A: Calcular o Coeficiente de Elasticidade (E)
    -- E = ((V_b - V_a) / V_a) / ((P_b - P_a) / P_a)
    e_coef := ((v_b - v_a) / v_a) / ((p_b - p_a) / p_a);

    -- Se E >= 0, o produto não tem comportamento elástico normal (demanda não cai com aumento de preço)
    -- Nesse caso extremo, tratar a lógica de negócio (ex: assumir inelasticidade e manter P_b)
    IF e_coef >= 0 THEN
        p_opt := p_b; -- ou aplicar regra de negócio
        m_proj := (p_b - c_tot) * v_b;
    ELSE
        -- Passo B: Calcular o Preço Ótimo (P*)
        -- P* = (P_a * (E - 1) + (E * C_total)) / (2 * E)
        p_opt := (p_a * (e_coef - 1) + (e_coef * c_tot)) / (2 * e_coef);

        -- Passo C: Projetar a Margem e Volume Esperados
        -- V_proj = V_a * [ 1 + E * ((P* - P_a) / P_a) ]
        v_proj := v_a * (1 + e_coef * ((p_opt - p_a) / p_a));
        
        -- M_proj = (P* - C_total) * V_proj
        m_proj := (p_opt - c_tot) * v_proj;
    END IF;

    -- Atualizar o teste com os resultados
    UPDATE elasticity_tests
    SET 
        elasticity_coef = e_coef,
        price_opt = p_opt,
        expected_margin_opt = m_proj,
        status = 'validating_opt',
        updated_at = now()
    WHERE id = test_uuid;

END;
$$;
