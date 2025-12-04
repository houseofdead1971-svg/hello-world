import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Sparkles, Pill, Clock, FileHeart, Shield, Calendar, MessageSquare, Users, Stethoscope, HeartPulse, Brain, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTransition } from "@/App";
import { motion } from "framer-motion";
import serviceVideo from "@/assets/service.mp4";

const animationStyles = `
  @keyframes fadeInSlideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  [data-animate-service],
  [data-animate-feature] {
    will-change: opacity, transform;
  }

  [data-animate-service].animate-fade-in-slide-up,
  [data-animate-feature].animate-fade-in-slide-up {
    animation: fadeInSlideUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .animate-delay-100 { animation-delay: 0.05s; }
  .animate-delay-200 { animation-delay: 0.1s; }
  .animate-delay-300 { animation-delay: 0.15s; }
  .animate-delay-400 { animation-delay: 0.2s; }
  .animate-delay-500 { animation-delay: 0.25s; }
  .animate-delay-600 { animation-delay: 0.3s; }
`;

const Services = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleCards, setVisibleCards] = useState<Record<string, boolean>>({});
  const [visibleFeatures, setVisibleFeatures] = useState<Record<string, boolean>>({});
  const { startTransition } = usePageTransition();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const services = [
    {
      icon: <Sparkles className="h-12 w-12" />,
      title: "AI Health Assistant",
      description: "Get instant, intelligent answers to your health questions 24/7. Our AI assistant helps you understand medications, symptoms, and medical records with personalized insights.",
      features: [
        "Natural language processing",
        "Medication interaction checks",
        "Symptom analysis",
        "Health record interpretation"
      ],
      gradient: "from-primary to-primary-light"
    },
    {
      icon: <Clock className="h-12 w-12" />,
      title: "Health Timeline",
      description: "Visualize your complete health journey in one comprehensive timeline. Track appointments, lab results, procedures, and important health events chronologically.",
      features: [
        "Chronological health events",
        "Lab results tracking",
        "Procedure history",
        "Appointment records"
      ],
      gradient: "from-primary-light to-accent"
    },
    {
      icon: <Pill className="h-12 w-12" />,
      title: "Medication Tracking",
      description: "Never miss a dose with smart medication reminders and comprehensive tracking. Manage all your medications, dosages, and schedules in one place.",
      features: [
        "Smart dose reminders",
        "Medication history",
        "Refill notifications",
        "Drug interaction alerts"
      ],
      gradient: "from-accent to-primary"
    },
    {
      icon: <FileHeart className="h-12 w-12" />,
      title: "Secure Records Management",
      description: "Upload, organize, and access your medical records anytime, anywhere. HIPAA-compliant encryption ensures your health data stays safe and private.",
      features: [
        "Encrypted cloud storage",
        "Easy file organization",
        "Quick search & retrieval",
        "Secure sharing options"
      ],
      gradient: "from-primary-dark to-primary"
    },
    {
      icon: <Calendar className="h-12 w-12" />,
      title: "Appointment Management",
      description: "Book, manage, and track all your healthcare appointments in one place. Get reminders and never miss an important medical visit.",
      features: [
        "Easy appointment booking",
        "Automated reminders",
        "Doctor availability",
        "Appointment history"
      ],
      gradient: "from-primary to-accent"
    },
    {
      icon: <Users className="h-12 w-12" />,
      title: "Doctor Network",
      description: "Connect with qualified healthcare professionals. View doctor profiles, specializations, and availability to find the right care for you.",
      features: [
        "Verified doctors",
        "Specialty search",
        "Real-time availability",
        "Patient reviews"
      ],
      gradient: "from-accent to-primary-light"
    }
  ];

  const additionalFeatures = [
    {
      icon: <Shield className="h-8 w-8" />,
      title: "HIPAA Compliant",
      description: "Industry-leading security standards protect your sensitive health information"
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "Smart Insights",
      description: "AI-powered analytics provide actionable health insights from your data"
    },
    {
      icon: <HeartPulse className="h-8 w-8" />,
      title: "Health Monitoring",
      description: "Track vital signs and health metrics to stay on top of your wellness"
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "24/7 Support",
      description: "Our AI assistant and support team are always available to help you"
    },
    {
      icon: <Stethoscope className="h-8 w-8" />,
      title: "Telemedicine Ready",
      description: "Connect with healthcare providers remotely for convenient consultations"
    },
    {
      icon: <Activity className="h-8 w-8" />,
      title: "Real-time Updates",
      description: "Get instant notifications about appointments, medications, and health events"
    }
  ];

  useEffect(() => {
    const observedCards = new Set<string>();
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !observedCards.has(entry.target.id)) {
          observedCards.add(entry.target.id);
          if (entry.target.getAttribute('data-animate-service')) {
            setVisibleCards((prev) => ({
              ...prev,
              [entry.target.id]: true,
            }));
          } else {
            setVisibleFeatures((prev) => ({
              ...prev,
              [entry.target.id]: true,
            }));
          }
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
    });

    const timer = setTimeout(() => {
      const cards = document.querySelectorAll("[data-animate-service], [data-animate-feature]");
      cards.forEach((card) => observer.observe(card));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
  <div className="min-h-screen relative isolate overflow-hidden bg-gradient-to-br from-background via-background to-secondary/20">
      <style>{animationStyles}</style>
      {/* Navigation Bar - Modern Professional Design */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/75 backdrop-blur-2xl shadow-lg shadow-primary/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between py-4 lg:py-5">
            {/* Logo with Enhanced Hover */}
            <Link 
              to="/" 
              className="flex items-center gap-3 group flex-shrink-0"
            >
              <div className="relative h-10 w-10 lg:h-12 lg:w-12 rounded-lg bg-gradient-to-br from-primary via-primary-light to-accent flex items-center justify-center shadow-lg shadow-primary/30 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/50 group-hover:scale-110 group-active:scale-95">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
                <Activity className="h-6 w-6 lg:h-7 lg:w-7 text-primary-foreground relative z-10" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary-light transition-all duration-500">MCare</h1>
                <p className="text-xs lg:text-sm text-muted-foreground group-hover:text-primary/80 transition-colors duration-500">Healthcare Platform</p>
              </div>
            </Link>

            {/* Desktop Navigation - Centered with Enhanced Effects */}
            <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 xl:gap-2">
              {[
                { label: "Home", path: "/" },
                { label: "Services", path: "/services" },
                { label: "About", path: "/about" }
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    item.path === "/services" 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {/* Background gradient - always visible for active, hover for others */}
                  {item.path === "/services" ? (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary-light opacity-100 transition-opacity duration-300"></div>
                  ) : (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  )}
                  
                  {/* Border effect */}
                  <div className={`absolute inset-0 rounded-lg border transition-colors duration-300 ${
                    item.path === "/services"
                      ? "border-primary/30"
                      : "border-transparent group-hover:border-primary/30"
                  }`}></div>
                  
                  {/* Text */}
                  <span className="relative flex items-center gap-1">
                    {item.label}
                    {item.path !== "/services" && (
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full group-hover:w-full transition-all duration-500"></span>
                    )}
                  </span>
                </Link>
              ))}
            </div>

            {/* Get Started Button - Desktop Only with Enhanced Hover */}
            <Link to="/auth" className="hidden lg:block">
              <Button 
                size="sm" 
                className="relative group bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-accent text-primary-foreground border border-primary/50 hover:border-accent/50 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 transition-all duration-500 hover:scale-105 active:scale-95 font-semibold px-6"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
                </span>
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 group-hover:animate-pulse"></div>
              </Button>
            </Link>

            {/* Mobile Menu Button with Smooth Animation */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 hover:bg-accent/20 active:bg-accent/30 rounded-lg transition-all duration-300 relative group"
              aria-label="Toggle menu"
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              {mobileMenuOpen ? (
                <X className="h-6 w-6 relative z-10 transition-transform duration-300 rotate-90" />
              ) : (
                <Menu className="h-6 w-6 relative z-10 transition-transform duration-300 group-hover:rotate-180" />
              )}
            </button>
          </div>

          {/* Mobile Menu with Smooth Animation */}
          {mobileMenuOpen && (
            <div className="lg:hidden overflow-hidden animate-in fade-in duration-500 ease-in-out">
              <div className="py-4 border-t border-primary/20 bg-gradient-to-b from-primary/5 to-accent/5 rounded-lg mt-2">
                <div className="flex flex-col gap-2 px-2">
                  {[
                    { label: "Home", path: "/" },
                    { label: "Services", path: "/services" },
                    { label: "About", path: "/about" }
                  ].map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="group relative px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300"
                    >
                      {/* Background hover effect */}
                      {item.path === "/services" ? (
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary-light"></div>
                      ) : (
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      )}
                      
                      {/* Text */}
                      <span className={`relative z-10 flex items-center gap-2 transition-colors duration-300 ${
                        item.path === "/services" 
                          ? "text-primary-foreground" 
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}>
                        {item.label}
                        <span className={`inline-block opacity-0 transition-all duration-300 ${
                          item.path === "/services" 
                            ? "opacity-100" 
                            : "group-hover:opacity-100 group-hover:translate-x-1"
                        }`}>→</span>
                      </span>
                    </Link>
                  ))}
                  
                  {/* Mobile Get Started Button */}
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="pt-2">
                    <Button 
                      size="sm" 
                      className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-accent text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 transition-all duration-500 active:scale-95 font-semibold"
                    >
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <section className="relative min-h-[75vh] md:min-h-screen flex items-center overflow-hidden pt-16">
        {/* Video background - plays on all screen sizes */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-[-1]"
          aria-hidden="true"
        >
          <source src={serviceVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-background/40 via-background/20 to-background/40 md:from-background/20 md:via-transparent md:to-background/20" />
        
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                <span className="text-white">Comprehensive Healthcare</span>
                <br />
                <span className="text-white">Solutions</span>
              </h1>
              <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto leading-relaxed font-medium">
                Everything you need to manage your health journey, all in one secure platform
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const cardId = `service-${index + 1}`;
              const delayClass = ['animate-delay-100', 'animate-delay-200', 'animate-delay-300', 'animate-delay-400', 'animate-delay-500', 'animate-delay-600'][index % 6];
              return (
              <div 
                key={index} 
                id={cardId} 
                data-animate-service 
                className={`group relative p-8 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 ${
                  visibleCards[cardId] ? `animate-fade-in-slide-up ${delayClass}` : ''
                }`}
                style={!visibleCards[cardId] ? { opacity: 0, transform: 'translateY(30px)' } : undefined}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative space-y-6">
                  <div className={`inline-flex p-4 rounded-md bg-gradient-to-br ${service.gradient} text-white shadow-lg`}>
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">{service.description}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-primary">Key Features:</p>
                    <ul className="space-y-2">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Why Choose MCare?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Built with cutting-edge technology and designed for your peace of mind</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => {
              const featureId = `feature-${index + 1}`;
              const delayClass = ['animate-delay-100', 'animate-delay-200', 'animate-delay-300', 'animate-delay-400', 'animate-delay-500', 'animate-delay-600'][index % 6];
              return (
              <div 
                key={index} 
                id={featureId} 
                data-animate-feature 
                className={`p-6 rounded-md bg-card border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                  visibleFeatures[featureId] ? `animate-fade-in-slide-up ${delayClass}` : ''
                }`}
                style={!visibleFeatures[featureId] ? { opacity: 0, transform: 'translateY(30px)' } : undefined}
              >
                <div className="inline-flex p-3 rounded-md bg-primary/10 text-primary mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-8 bg-gradient-to-br from-primary to-primary-light rounded-lg p-12 md:p-16 text-primary-foreground shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold">Ready to Transform Your Healthcare Experience?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">Join thousands of users who trust MCare for their health management needs</p>
            <div className="pt-4 flex justify-center">
              <motion.button
                ref={buttonRef}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  startTransition(rect.left + rect.width / 2, rect.top + rect.height / 2);
                  setTimeout(() => navigate('/auth'), 400);
                }}
                onMouseMove={(e) => {
                  if (!buttonRef.current) return;
                  const rect = buttonRef.current.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const deltaX = (e.clientX - centerX) * 0.15;
                  const deltaY = (e.clientY - centerY) * 0.15;
                  setMousePosition({ x: deltaX, y: deltaY });
                }}
                onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
                animate={{ x: mousePosition.x, y: mousePosition.y }}
                transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 rounded-md inline-block"
              >
                <div className="relative h-14 rounded-md overflow-hidden shadow-lg transition-shadow duration-300 group-hover:shadow-xl group-active:shadow-xl group-active:scale-95">
                  {/* Gradient border wrapper */}
                  <div className="absolute inset-0 rounded-md bg-white/10" />
                  {/* Button surface with slide-up fill */}
                  <div className="relative z-10 flex h-14 items-center justify-center px-8 rounded-md bg-white text-lg font-medium text-primary overflow-hidden">
                    {/* Slide-up accent background */}
                    <span className="absolute inset-0 bg-accent origin-bottom scale-y-0 transition-transform duration-500 ease-out group-hover:scale-y-100 group-active:scale-y-100" aria-hidden="true" />
                    {/* Text with color inversion */}
                    <span className="relative z-10 transition-colors duration-500 ease-out group-hover:text-primary-foreground group-active:text-primary-foreground">
                      Get Started Free
                    </span>
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MCare. All rights reserved.</p>
            <p>Designed by <a href="https://www.linkedin.com/in/mayur005" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Mayur Kaarthic S V</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Services;