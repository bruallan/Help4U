import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function AdminAcessos() {
  const [emails, setEmails] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Síndico');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('authorized_emails').select('*').order('created_at', { ascending: false });
    if (data) setEmails(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: adminPassword,
      });

      if (signInError) throw new Error('Senha de administrador incorreta.');

      const { error } = await supabase
        .from('authorized_emails')
        .insert({
          contact_email: newEmail,
          role: newRole,
        });

      if (error) throw error;
      
      setNewEmail('');
      setAdminPassword('');
      fetchEmails();
      alert('Acesso concedido com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Remover este acesso?')) return;
    if (!supabase) return;
    await supabase.from('authorized_emails').delete().eq('id', id);
    fetchEmails();
  };

  if (!supabase) {
    return <div className="p-6 text-slate-500">Supabase não configurado.</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Perfis de Acesso (Administração)</h2>
      </div>

      <form onSubmit={handleAdd} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail do Novo Usuário</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Perfil (Role)</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
          >
            <option value="Síndico">Síndico</option>
            <option value="Equipe interna">Equipe interna</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sua Senha (Admin)</label>
          <input
            type="password"
            required
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
            placeholder="Confirme sua senha..."
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Adicionando...' : 'Adicionar'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">E-mail Autorizado</th>
              <th className="px-4 py-3 font-semibold">Perfil</th>
              <th className="px-4 py-3 font-semibold">Local ID (Síndico)</th>
              <th className="px-4 py-3 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {emails.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{e.contact_email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${e.role === 'Equipe interna' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {e.role}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-500">{e.main_location_id || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum e-mail autorizado encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
