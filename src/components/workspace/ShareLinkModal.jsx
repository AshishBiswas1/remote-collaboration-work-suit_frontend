import { useState } from "react";
import { sessionAPI } from "../../services/sessionApi";

export function ShareLinkModal({ isOpen, onClose, sessionId, sessionName }) {
  const [formData, setFormData] = useState({
    expiresInHours: 24,
    maxUses: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value === '' || value === 'null' ? null : value
    });
    setError('');
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const options = {};
      if (formData.expiresInHours) {
        options.expiresInHours = parseInt(formData.expiresInHours);
      }
      if (formData.maxUses && formData.maxUses !== 'null') {
        options.maxUses = parseInt(formData.maxUses);
      }

      const response = await sessionAPI.generateShareLink(sessionId, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate share link');
      }

      const result = await response.json();
      setGeneratedLink(result.data);
      
    } catch (err) {
      setError(err.message || 'Failed to generate share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink?.shareableLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink.shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy link to clipboard');
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ expiresInHours: 24, maxUses: null });
      setError('');
      setGeneratedLink(null);
      setCopied(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Share Session
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
            Generate a shareable link for: <span className="font-semibold">{sessionName}</span>
          </p>

          {!generatedLink ? (
            <form onSubmit={handleGenerateLink} className="space-y-4 sm:space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="expiresInHours" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Link Expires In (Hours)
                </label>
                <select
                  name="expiresInHours"
                  id="expiresInHours"
                  value={formData.expiresInHours}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm sm:text-base"
                  disabled={loading}
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="168">1 week</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxUses" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Maximum Uses
                </label>
                <select
                  name="maxUses"
                  id="maxUses"
                  value={formData.maxUses || 'null'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm sm:text-base"
                  disabled={loading}
                >
                  <option value="null">Unlimited</option>
                  <option value="1">1 use</option>
                  <option value="5">5 uses</option>
                  <option value="10">10 uses</option>
                  <option value="25">25 uses</option>
                  <option value="50">50 uses</option>
                  <option value="100">100 uses</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start">
                  <div className="text-blue-500 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">ℹ️</div>
                  <div className="min-w-0">
                    <h4 className="text-blue-800 font-medium mb-1 text-sm sm:text-base">Share Link Info</h4>
                    <ul className="text-blue-700 text-xs sm:text-sm space-y-1">
                      <li>• Link allows others to join your session directly</li>
                      <li>• Recipients don't need to create an account</li>
                      <li>• Link will expire based on your settings</li>
                      <li>• You can generate new links anytime</li>
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
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm sm:text-base font-semibold disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                      Generating...
                    </div>
                  ) : (
                    'Generate Link'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">✅</div>
                  <div className="min-w-0">
                    <h4 className="text-green-800 font-medium text-sm sm:text-base">Link Generated Successfully!</h4>
                    <p className="text-green-700 text-xs sm:text-sm">Share this link with others to invite them to your session.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shareable Link
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={generatedLink.shareableLink}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50 text-gray-900 text-sm sm:text-base"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2 border border-l-0 border-gray-300 rounded-r-lg transition-colors text-sm sm:text-base font-medium ${
                      copied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-medium text-gray-700 mb-1">Expires</div>
                  <div className="text-gray-600">
                    {new Date(generatedLink.expiresAt).toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-medium text-gray-700 mb-1">Max Uses</div>
                  <div className="text-gray-600">
                    {generatedLink.maxUses === 'unlimited' ? 'Unlimited' : `${generatedLink.maxUses} uses`}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setGeneratedLink(null);
                    setFormData({ expiresInHours: 24, maxUses: null });
                  }}
                  className="flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base font-medium"
                >
                  Generate New Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}