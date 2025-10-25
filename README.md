# Remote Work Collaboration Frontend

A React-based frontend for a remote work collaboration platform with real-time video calling, document collaboration, and team chat features.

## Features

- **Video Calling**: Real-time video calls with screen sharing
- **Document Collaboration**: Collaborative document editing with Y.js
- **Team Chat**: Real-time messaging with Socket.IO
- **Whiteboard**: Collaborative drawing and sketching
- **Task Management**: Team task boards and project management

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Running the Application

#### For Local Development (HTTP)
```bash
npm run dev
```
This runs on `http://localhost:5173`

#### For Local Development with HTTPS (Required for Camera/Microphone)
```bash
npm run dev:https
```
This runs on `https://localhost:5173`

**Note**: HTTPS is required for camera and microphone access in browsers. Use `npm run dev:https` for video call testing.

### Building for Production

```bash
npm run build
npm run preview
```

## Video Call Troubleshooting

If you're experiencing issues with camera/microphone access:

### 1. HTTPS Requirement
- Video calls require HTTPS in production and for local testing
- Use `npm run dev:https` for local development
- Deployed apps automatically use HTTPS

### 2. Browser Permissions
- When prompted, click "Allow" for camera and microphone access
- Check browser settings to ensure permissions are enabled for the site

### 3. Common Issues

**"Camera/microphone access denied"**
- Click "Allow" when your browser prompts for permissions
- Check browser settings: Chrome → Settings → Privacy → Site settings → Camera/Microphone

**"No camera/microphone found"**
- Ensure your camera/microphone is connected
- Close other applications that might be using them
- Try refreshing the page

**"Camera/microphone is already in use"**
- Close other browser tabs or applications using media devices
- Restart your browser

### 4. Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited support (use Chrome for best experience)

### 5. Network Requirements
- Stable internet connection required for video calls
- Minimum 1 Mbps upload/download recommended
- Firewall should allow WebRTC connections

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=https://your-backend-url
VITE_WS_URL=wss://your-backend-url/yjs-ws
VITE_SOCKET_URL=https://your-backend-url
```

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Socket.IO** - Real-time communication
- **Y.js** - Collaborative editing
- **WebRTC** - Peer-to-peer video/audio
- **Tailwind CSS** - Styling
- **Fabric.js** - Whiteboard functionality
- **Quill** - Rich text editing
