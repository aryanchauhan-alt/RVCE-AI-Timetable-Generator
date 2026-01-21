import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, User, Lock, ArrowRight } from 'lucide-react';
import heroBg from '../assets/rvce_hero_real.jpg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate login based on credentials for demo purposes
    // In production, this would be a real API call
    try {
      let role = 'student';
      const lowerEmail = email.toLowerCase();
      if (lowerEmail === 'admin' || lowerEmail.includes('admin')) role = 'admin';
      else if (lowerEmail.includes('teacher')) role = 'teacher';

      await login(email, password, role);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch font-sans-body">
      {/* Left Side - Image/Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-navy/40 z-10"></div>
        <img src={heroBg} alt="Campus" className="absolute inset-0 w-full h-full object-cover opacity-90" />

        <div className="relative z-20 flex flex-col justify-between p-16 h-full text-white">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors">
              <ArrowLeft size={20} />
              <span className="tracking-widest text-xs font-bold uppercase">Back to Home</span>
            </div>
          </div>

          <div>
            <span className="inline-block py-1 px-3 border border-gold/50 text-gold text-xs tracking-widest uppercase mb-6 rounded-full">
              ERP Portal
            </span>
            <h1 className="font-serif text-5xl leading-tight mb-6">
              Your Gateway to <br /> <span className="italic font-light">Academic Excellence</span>
            </h1>
            <p className="text-white/70 max-w-md font-light leading-relaxed">
              Access your timetable, manage courses, and connect with the RVCE community through our centralized portal.
            </p>
          </div>

          <div className="text-xs text-white/40 tracking-wider">
            © 2026 RV College of Engineering
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-bg-primary flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="lg:hidden mb-12">
            <div className="cursor-pointer mb-8 inline-block" onClick={() => navigate('/')}>
              <div className="flex items-center space-x-2 text-text-secondary hover:text-navy transition-colors">
                <ArrowLeft size={18} />
                <span className="tracking-widest text-xs font-bold uppercase">Back to Home</span>
              </div>
            </div>
            <h2 className="font-serif text-4xl text-navy mb-2">Welcome Back</h2>
            <p className="text-text-secondary">Please enter your details to sign in.</p>
          </div>

          <div className="hidden lg:block mb-12">
            <h2 className="font-serif text-4xl text-navy mb-3">Sign In</h2>
            <p className="text-text-secondary font-light">Welcome back to the RVCE digital campus.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-2 border-red-500 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-navy uppercase tracking-widest ml-1">Username or Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-sm text-navy placeholder-gray-300 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy transition-colors"
                  placeholder="admin or name@rvce.edu.in"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-navy uppercase tracking-widest">Password</label>
                <a href="#" className="text-xs text-text-secondary hover:text-navy underline underline-offset-4">Forgot Password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-sm text-navy placeholder-gray-300 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy text-white text-sm font-bold uppercase tracking-widest py-4 rounded-sm hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy transition-all flex items-center justify-center space-x-2 group"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
            </button>

            <div className="pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-text-secondary font-light">
                Don't have an account? <span className="font-medium text-navy cursor-pointer hover:underline">Contact Administration</span>
              </p>
            </div>
          </form>

          <div className="mt-12 text-center lg:hidden">
            <span className="text-xs text-gray-400 tracking-wider">© 2026 RV College of Engineering</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
