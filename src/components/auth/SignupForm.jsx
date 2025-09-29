import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function SignupForm({ onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signup } = useAuth();

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

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful signup
      const userData = {
        id: Date.now(),
        name: formData.name,
        email: formData.email
      };
      
      signup(userData, 'mock-jwt-token');
      onClose();
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Full Name
        </label>
        <input
          type="text"
          name="name"
          id="name"
          required
          placeholder="Enter your full name"
          value={formData.name}
          onChange={handleChange}
          className="input-modern"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
          className="input-modern"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          name="password"
          id="password"
          required
          placeholder="Create a password (min. 6 characters)"
          value={formData.password}
          onChange={handleChange}
          className="input-modern"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          name="confirmPassword"
          id="confirmPassword"
          required
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="input-modern"
          disabled={loading}
        />
      </div>

      <div className="flex items-start">
        <input
          id="terms"
          type="checkbox"
          required
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
          disabled={loading}
        />
        <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
          I agree to the{' '}
          <button type="button" className="text-blue-600 hover:text-blue-800 underline transition-colors">
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="text-blue-600 hover:text-blue-800 underline transition-colors">
            Privacy Policy
          </button>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-form-primary w-full py-3 text-base font-semibold"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Creating account...
          </div>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
