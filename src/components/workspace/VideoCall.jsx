import { useEffect, useRef, useState } from "react";

export function VideoCall({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    let localStream = null;

    const startVideo = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        
        setStream(localStream);
        setIsConnected(true);

        // Simulate remote video after 2 seconds
        setTimeout(() => {
          if (remoteVideoRef.current && localStream) {
            // For demo purposes, show local stream as remote too
            remoteVideoRef.current.srcObject = localStream;
          }
        }, 2000);

      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    startVideo();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setIsConnected(false);
  };

  return (
    <div className="card-modern p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">Video Conference</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">Room: {roomId}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Local video */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            You
          </div>
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-2xl text-white">👤</span>
              </div>
            </div>
          )}
        </div>

        {/* Remote video */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
            Participant
          </div>
          {!isConnected && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <span className="text-white text-sm">Waiting for participants...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors ${
            isAudioOn ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-500 text-white'
          }`}
          title={isAudioOn ? 'Mute' : 'Unmute'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d={isAudioOn ? 
              "M9 4a1 1 0 011-1 1 1 0 011 1v5.92a1 1 0 01-2 0V4z M15 9a1 1 0 00-1-1v4.92a2.5 2.5 0 01-5 0V8a1 1 0 00-2 0v4.92a4.5 4.5 0 009 0V9z"
              : "M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0L18.485 7.757a1 1 0 010 1.414L17.071 10.585l1.414 1.414a1 1 0 11-1.414 1.414L15.657 11.999l-1.414 1.414a1 1 0 11-1.414-1.414l1.414-1.414-1.414-1.414a1 1 0 010-1.414z"
            } clipRule="evenodd" />
          </svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            isVideoOn ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-500 text-white'
          }`}
          title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d={isVideoOn ? 
              "M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"
              : "M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13V7a1 1 0 00-1.447-.894l-2 1A1 1 0 0014 8v.586l-2-2V6a2 2 0 00-2-2H8.414l-5.707-5.707z"
            } />
          </svg>
        </button>

        <button
          onClick={endCall}
          className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          title="End call"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </button>

        <button
          className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
          title="Share screen"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 11-2 0V5H5v10h4a1 1 0 110 2H4a1 1 0 01-1-1V4zm7.707 4.293a1 1 0 00-1.414 1.414L10.586 11H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414l-3-3z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
