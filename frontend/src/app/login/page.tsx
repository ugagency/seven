"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, ChevronRight, Loader2, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const supabase = createClient();

    const handleAuth = async (isSignUp: boolean) => {
        setIsLoading(true);
        setError("");

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setError("Verifique seu e-mail para confirmar a conta! Ou se email confirmation estiver desativado, tente fazer login.");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push("/");
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro ao autenticar.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 font-sans overflow-hidden bg-slate-50">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-pink-300/40 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-indigo-300/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] bg-emerald-300/30 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-4000"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[400px]"
            >
                <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 mb-2">Login</h1>
                        <p className="text-slate-500 font-medium">Sevenbot Platform</p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleAuth(false); }} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">
                                E-mail
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    placeholder="seu@email.com"
                                    className="w-full bg-white/70 border border-slate-200/60 rounded-2xl pl-11 pr-5 py-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all shadow-inner group-hover:bg-white/90"
                                    value={email}
                                    disabled={isLoading}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">
                                Senha
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-white/70 border border-slate-200/60 rounded-2xl pl-11 pr-5 py-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all shadow-inner group-hover:bg-white/90"
                                    value={password}
                                    disabled={isLoading}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm text-center font-medium mt-2 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>
                        )}

                        <div className="flex flex-col space-y-3 mt-6">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-xl shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                                <div className="relative flex items-center justify-center space-x-2 px-6 py-4">
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 text-white/90 animate-spin" />
                                    ) : (
                                        <>
                                            <span className="text-white font-semibold tracking-wide">Entrar</span>
                                            <ChevronRight className="w-5 h-5 text-white/70" />
                                        </>
                                    )}
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleAuth(true)}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-70 active:scale-95 shadow-sm"
                            >
                                <UserPlus className="w-5 h-5 text-slate-500" />
                                <span className="font-semibold">Criar Conta Nova</span>
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
