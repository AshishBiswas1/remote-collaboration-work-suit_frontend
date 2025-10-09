import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { authAPI } from "../../services/authApi";
import { setCookie } from "../../utils/cookies";

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
      // Call backend login API
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Extract user data and session from response
        const userData = {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.full_name,
          full_name: result.data.user.full_name,
          email_verified: result.data.user.email_verified
        };
        const token = result.data.session.access_token;
        const expiresAt = result.data.session.expires_at;
        
        // Manually set the JWT cookie (backup in case backend cookie doesn't work)
        setCookie('jwt', token, {
          expires: new Date(expiresAt * 1000),
          secure: window.location.protocol === 'https:',
          sameSite: 'strict',
          path: '/'
        });
        
        // Use the auth context login function
        login(userData, token);
        onClose();
      } else {
        // Handle specific error cases
        if (result.message.includes('verify your email')) {
          setError('Please verify your email before logging in. Check your inbox for the verification link.');
        } else {
          setError(result.message || 'Invalid email or password');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in. Please check your connection and try again.');
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
