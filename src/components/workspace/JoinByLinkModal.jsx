import { useState, useEffect } from "react";
import { sessionAPI } from "../../services/sessionApi";

export function JoinByLinkModal({ isOpen, onClose, onJoinSuccess, initialUrl = '' }) {
  const [invitationUrl, setInvitationUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update invitation URL when initialUrl prop changes
  useEffect(() => {
    if (initialUrl) {
      setInvitationUrl(initialUrl);
    }
  }, [initialUrl]);

  const parseInvitationUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const invitation = urlObj.searchParams.get('invitation');
      
      // If we have invitation data, decode it to get sessionId
      if (invitation) {
        try {
          // Use browser-compatible base64 decoding
          const decodedData = atob(invitation);
          const invitationData = JSON.parse(decodedData);
          const sessionId = invitationData.sessionId;
          
          return { invitation, sessionId };
        } catch (decodeError) {
          throw new Error('Invalid invitation data format');
        }
      }
      
      // Fallback to direct parameters (for backward compatibility)
      const sessionId = urlObj.searchParams.get('sessionId') || urlObj.searchParams.get('session');
      return { invitation, sessionId };
      
    } catch (err) {
      throw new Error('Invalid URL format');
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!invitationUrl.trim()) {
      setError('Please enter an invitation URL');
      setLoading(false);
      return;
    }

    try {
      // Parse the invitation URL
      const { invitation, sessionId } = parseInvitationUrl(invitationUrl.trim());
      
      if (!invitation || !sessionId) {
        throw new Error('Invalid invitation URL. Missing invitation data or session ID.');
      }

      // Call the backend API
      const response = await sessionAPI.joinSessionByLink(sessionId, invitation);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to join session');
      }

      const result = await response.json();
      const sessionData = result.data.session;

      // Call success callback with session data
      onJoinSuccess({
        id: sessionData.session_token,
        name: sessionData.session_name,
        joinedAt: Date.now(),
        backendSessionId: sessionData.id,
        sessionToken: sessionData.session_token,
        creatorId: sessionData.creator_id,
        expiresAt: sessionData.expires_at,
        joinedViaInvitation: true,
        websocketUrl: sessionData.websocket_url
      });

      // Reset form and close modal
      setInvitationUrl('');
      setError('');
      onClose();

    } catch (err) {
      setError(err.message || 'Failed to join session. Please check your invitation URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setInvitationUrl('');
      setError('');
      onClose();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInvitationUrl(text);
      setError('');
    } catch (err) {
      setError('Failed to read from clipboard. Please paste manually.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Join Session by Link
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
            Enter the invitation URL you received to join an existing collaboration session.
          </p>

          <form onSubmit={handleJoinSession} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="invitationUrl" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Invitation URL <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <input
                  type="url"
                  name="invitationUrl"
                  id="invitationUrl"
                  required
                  placeholder="http://localhost:5173/join-session?invitation=xxxxx"
                  value={invitationUrl}
                  onChange={(e) => {
                    setInvitationUrl(e.target.value);
                    setError('');
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm sm:text-base"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  disabled={loading}
                  className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors text-sm sm:text-base font-medium disabled:opacity-50"
                >
                  📋 Paste
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paste the complete invitation URL you received from the session creator
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="text-blue-500 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">ℹ️</div>
                <div className="min-w-0">
                  <h4 className="text-blue-800 font-medium mb-1 text-sm sm:text-base">How it works</h4>
                  <ul className="text-blue-700 text-xs sm:text-sm space-y-1">
                    <li>• Paste the invitation URL you received</li>
                    <li>• We'll validate the invitation and check if it's still active</li>
                    <li>• You'll be automatically added to the session</li>
                    <li>• Start collaborating with video, docs, chat, and more!</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="text-yellow-500 text-base sm:text-lg mr-2 sm:mr-3 flex-shrink-0">⚠️</div>
                <div className="min-w-0">
                  <h4 className="text-yellow-800 font-medium mb-1 text-sm sm:text-base">Important Notes</h4>
                  <ul className="text-yellow-700 text-xs sm:text-sm space-y-1">
                    <li>• Invitation links may have expiration dates</li>
                    <li>• Some links have limited number of uses</li>
                    <li>• Make sure you have a stable internet connection</li>
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
                disabled={loading || !invitationUrl.trim()}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors text-sm sm:text-base font-semibold disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  'Join Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}