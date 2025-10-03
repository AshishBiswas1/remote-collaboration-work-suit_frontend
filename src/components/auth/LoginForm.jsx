import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function LoginForm({ onClose }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful login
      const userData = {
        id: 1,
        name: formData.email.split('@')[0],
        email: formData.email
      };
      
      login(userData, 'mock-jwt-token');
      onClose();
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
          Email Address
        </label>
        <input
          type="email"
          name="email"
          id="email"
          required
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          className="input-modern text-sm sm:text-base"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
          Password
        </label>
        <input
          type="password"
          name="password"
          id="password"
          required
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          className="input-modern text-sm sm:text-base"
          disabled={loading}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <label className="flex items-center">
          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="ml-2 text-xs sm:text-sm text-gray-600">Remember me</span>
        </label>
        <button type="button" className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors text-left sm:text-right">
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-form-primary w-full py-2.5 sm:py-3 text-sm sm:text-base font-semibold"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
            Signing in...
          </div>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}
