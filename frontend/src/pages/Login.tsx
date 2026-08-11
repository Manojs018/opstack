import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BorderBeamPanel } from '@/components/ui/border-beam-panel';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Auto-redirect if already logged in
  React.useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/');
    }
  }, [navigate]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post('/auth/login', { email, password });
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    },
    onError: (error: any) => {
      setValidationError(
        error.response?.data?.error?.message || 'Login failed. Please check your credentials.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!email || !password) {
      setValidationError('Please fill in all fields');
      return;
    }

    loginMutation.mutate();
  };

  const fillCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setValidationError('');
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-zinc-950 p-4 overflow-hidden">
      {/* Embedded Dashboard Mockup Background */}
      <DashboardMockup />
      
      {/* Backdrop blur & Dark overlay */}
      <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[3px] z-10 pointer-events-none" />

      <div className="relative z-20 w-full max-w-md space-y-4">
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-indigo-500/20">
            Ω
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Operations Portal</h1>
          <p className="text-zinc-400 text-sm">Mini ERP + CRM Management</p>
        </div>

        <BorderBeamPanel
          className="w-full rounded-xl"
          beams={1}
          thickness={1.5}
          radius={12}
          glow={false}
          colorFrom="#6366F1"
          colorTo="#26262C"
        >
          <Card className="border-none bg-transparent backdrop-blur-none shadow-none">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your credentials to access the portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
                  />
                </div>

                {validationError && (
                  <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    {validationError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 border-t border-zinc-800 pt-6">
              <div className="w-full">
                <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide text-center">
                  Demo Accounts (Click to Fill)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 py-1"
                    onClick={() => fillCredentials('admin@company.com', 'AdminPass123!')}
                  >
                    Admin
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 py-1"
                    onClick={() => fillCredentials('sales@company.com', 'SalesPass123!')}
                  >
                    Sales
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 py-1"
                    onClick={() => fillCredentials('warehouse@company.com', 'WarehousePass123!')}
                  >
                    Warehouse
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 py-1"
                    onClick={() => fillCredentials('accounts@company.com', 'AccountsPass123!')}
                  >
                    Accounts
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </BorderBeamPanel>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="absolute inset-0 w-full h-full bg-zinc-950 text-zinc-500 select-none pointer-events-none flex scale-[0.97] opacity-20 blur-[0.8px] z-0 overflow-hidden">
      {/* Sidebar Mock */}
      <div className="w-64 border-r border-zinc-800 p-4 space-y-6 flex flex-col h-full bg-zinc-900/30">
        <div className="flex items-center space-x-2 px-3 py-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-650 flex items-center justify-center font-bold text-white">Ω</div>
          <span className="font-bold text-lg text-zinc-300">Operations Portal</span>
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-8 bg-zinc-900 rounded w-full border border-zinc-800/40"></div>
          <div className="h-8 bg-zinc-900 rounded w-full border border-zinc-800/40"></div>
          <div className="h-8 bg-zinc-900 rounded w-full border border-zinc-800/40"></div>
          <div className="h-8 bg-zinc-900 rounded w-full border border-zinc-800/40"></div>
        </div>
      </div>
      {/* Main Area Mock */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header Mock */}
        <div className="h-16 border-b border-zinc-800 px-8 flex items-center justify-between bg-zinc-900/10">
          <div className="h-4 bg-zinc-900 rounded w-32 border border-zinc-800/40"></div>
          <div className="h-8 bg-zinc-900 rounded w-24 border border-zinc-800/40"></div>
        </div>
        {/* Body Mock */}
        <div className="p-8 space-y-6 flex-1">
          <div className="h-12 bg-zinc-900 rounded w-1/3 border border-zinc-800/40"></div>
          <div className="grid grid-cols-4 gap-4 h-48">
            <div className="col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-lg p-4"></div>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4"></div>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4"></div>
          </div>
          <div className="grid grid-cols-2 gap-4 h-48">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4"></div>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
