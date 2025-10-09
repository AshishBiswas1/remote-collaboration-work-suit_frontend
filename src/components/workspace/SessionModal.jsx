import { useState } from "react";

export function SessionModal({ isOpen, onClose, onCreateSession, user }) {
  const [formData, setFormData] = useState({
    session_name: '',
    max_participants: 'unlimited'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!formData.session_name.trim()) {
      setError('Please provide a session name');
      setLoading(false);
      return;
    }

    try {
      await onCreateSession({
        session_name: formData.session_name.trim(),
        creator_id: user?.id || "anonymous",
        max_participants: formData.max_participants
      });
      
      // Reset form and close modal on success
      setFormData({
        session_name: '',
        max_participants: 'unlimited'
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        session_name: '',
        max_participants: 'unlimited'
      });
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Create New Session
            </h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-50"
            >
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            Set up your collaboration session with custom settings
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="session_name" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Session Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="session_name"
                id="session_name"
                required
                placeholder="Enter session name (e.g., Team Meeting, Project Review)"
                value={formData.session_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm sm:text-base"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="max_participants" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Maximum Participants
              </label>
              <select
                name="max_participants"
                id="max_participants"
                value={formData.max_participants}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm sm:text-base"
                disabled={loading}
              >
                <option value="unlimited">Unlimited</option>
                <option value="2">2 participants</option>
                <option value="5">5 participants</option>
                <option value="10">10 participants</option>
                <option value="20">20 participants</option>
                <option value="50">50 participants</option>
                <option value="100">100 participants</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="text-blue-500 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">ℹ️</div>
                <div className="min-w-0">
                  <h4 className="text-blue-800 font-medium mb-1 text-sm sm:text-base">Session Details</h4>
                  <ul className="text-blue-700 text-xs sm:text-sm space-y-1">
                    <li>• Session will expire in 24 hours</li>
                    <li>• You'll be set as the session creator</li>
                    <li>• Chat server will start automatically</li>
                    <li>• Share the link with participants</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.session_name.trim()}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm sm:text-base font-semibold disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}