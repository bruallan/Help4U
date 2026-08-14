-- 1. Tabela de E-mails Autorizados
CREATE TABLE public.authorized_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Equipe interna', 'Síndico')),
    main_location_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;

-- 2. Trigger para vincular usuário recém-criado com seu perfil em authorized_emails
-- Esta função é opcional se você for buscar o perfil sempre por e-mail, mas é boa prática
-- ter uma tabela de perfis (profiles) atrelada ao auth.users. 
-- Simplificando: vamos consultar diretamente a authorized_emails no Frontend usando RLS:
CREATE POLICY "Leitura permitida para usuários autenticados e admin" 
ON public.authorized_emails FOR SELECT 
TO authenticated 
USING (
  contact_email = auth.jwt() ->> 'email' OR 
  EXISTS (
    SELECT 1 FROM public.authorized_emails auth_admin 
    WHERE auth_admin.contact_email = auth.jwt() ->> 'email' AND auth_admin.role = 'Equipe interna'
  )
);

CREATE POLICY "Escrita apenas para Equipe Interna" 
ON public.authorized_emails FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.authorized_emails auth_admin 
    WHERE auth_admin.contact_email = auth.jwt() ->> 'email' AND auth_admin.role = 'Equipe interna'
  )
);
