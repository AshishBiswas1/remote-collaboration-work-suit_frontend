import { useState, useEffect, useRef } from "react";

export function Features() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  const features = [
    {
      icon: "🎥",
      title: "HD Video Conferencing",
      description: "Crystal clear video calls with advanced noise cancellation, screen sharing, and up to 100 participants.",
      gradient: "from-blue-500 to-purple-600",
      details: ["4K video quality", "Real-time screen sharing", "Recording & playback", "Virtual backgrounds"]
    },
    {
      icon: "📝",
      title: "Real-time Documents",
      description: "Collaborate on documents simultaneously with live cursor tracking, comments, and version history.",
      gradient: "from-green-500 to-teal-600",
      details: ["Live collaboration", "Version control", "Smart comments", "Export options"]
    },
    {
      icon: "🎨",
      title: "Interactive Whiteboard",
      description: "Unlimited digital canvas with advanced drawing tools, shapes, and real-time collaboration.",
      gradient: "from-pink-500 to-rose-600",
      details: ["Unlimited canvas", "Advanced tools", "Template library", "Export as image"]
    },
    {
      icon: "📋",
      title: "Smart Task Management",
      description: "AI-powered project management with Kanban boards, automation, and progress tracking.",
      gradient: "from-yellow-500 to-orange-600",
      details: ["Kanban boards", "AI automation", "Time tracking", "Progress analytics"]
    },
    {
      icon: "💬",
      title: "Team Communication",
      description: "Persistent chat rooms with file sharing, mentions, and seamless integration with all tools.",
      gradient: "from-indigo-500 to-blue-600",
      details: ["Persistent chat", "File sharing", "Smart notifications", "Thread replies"]
    },
    {
      icon: "🔒",
      title: "Enterprise Security",
      description: "Bank-level encryption, SSO integration, and compliance with GDPR, HIPAA, and SOC 2.",
      gradient: "from-red-500 to-pink-600",
      details: ["End-to-end encryption", "SSO integration", "Compliance ready", "Audit logs"]
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [features.length]);

  return (
    <section ref={sectionRef} id="features" className="py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className={`text-4xl md:text-6xl font-black text-gray-900 mb-6 ${isVisible ? 'animate-fade-in' : ''}`}>
            Everything You Need to
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Collaborate Smarter
            </span>
          </h2>
          <p className={`text-xl text-gray-600 max-w-3xl mx-auto ${isVisible ? 'animate-slide-up' : ''}`}>
            Our comprehensive suite of tools is designed to make remote collaboration 
            as natural and productive as working in the same room.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`card-modern p-8 cursor-pointer transition-all duration-300 ${
                activeFeature === index ? 'ring-2 ring-blue-500 shadow-2xl scale-105' : ''
              } ${isVisible ? 'animate-slide-up' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => setActiveFeature(index)}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 mb-4">{feature.description}</p>
                  <div className="space-y-2">
                    {feature.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center text-sm text-gray-500">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></div>
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
