import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!supabase) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const emailTrimmed = email.trim();
    
    try {
      if (isSignUp) {
        const { data: authCheck, error: authError } = await supabase
          .from('authorized_emails')
          .select('contact_email')
          .eq('contact_email', emailTrimmed)
          .single();

        if (authError) {
          console.error("Supabase Auth Check Error:", authError);
          if (authError.code === 'PGRST116') {
             throw new Error('E-mail não está pré-autorizado pelo administrador.');
          }
          if (authError.code === 'PGRST125') {
             throw new Error('Tabela não encontrada no Supabase. Rode o script SQL (Passo 6) corretamente.');
          }
          throw new Error(`Erro no banco: ${authError.message}`);
        }

        if (!authCheck) {
          throw new Error('E-mail não está pré-autorizado pelo administrador.');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: emailTrimmed,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage('Verifique seu e-mail para o link de confirmação!');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailTrimmed,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, informe seu e-mail primeiro.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage('E-mail de recuperação enviado!');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-purple-600/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-purple-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">VMPay Manager</h1>
          <p className="text-slate-400 text-sm mt-2">Acesso restrito</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg mb-4">{error}</div>}
        {message && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-sm p-3 rounded-lg mb-4">{message}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre' : 'Não tem conta? Cadastre-se'}
          </button>
          
          {!isSignUp && (
            <button
              onClick={handleResetPassword}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
