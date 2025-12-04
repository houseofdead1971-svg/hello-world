import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Target, Eye, Heart, Shield, Users, Sparkles, Award, TrendingUp, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTransition } from "@/App";
import { motion } from "framer-motion";
import mayurPhoto from "@/assets/mayur-photo.jpg";

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

  [data-animate-value] {
    will-change: opacity, transform;
  }

  [data-animate-value].animate-fade-in-slide-up {
    animation: fadeInSlideUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .animate-delay-100 { animation-delay: 0.05s; }
  .animate-delay-200 { animation-delay: 0.1s; }
  .animate-delay-300 { animation-delay: 0.15s; }
  .animate-delay-400 { animation-delay: 0.2s; }
`;

const About = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});
  const { startTransition } = usePageTransition();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const values = [
    {
      icon: <Shield className="h-10 w-10" />,
      title: "Privacy First",
      description: "Your health data is sacred. We use industry-leading encryption and HIPAA-compliant security to ensure your information stays private and secure."
    },
    {
      icon: <Heart className="h-10 w-10" />,
      title: "Patient-Centered",
      description: "Every feature is designed with you in mind. We believe healthcare should be accessible, understandable, and empowering for everyone."
    },
    {
      icon: <Sparkles className="h-10 w-10" />,
      title: "Innovation",
      description: "We leverage cutting-edge AI and technology to make healthcare management smarter, faster, and more intuitive than ever before."
    },
    {
      icon: <Users className="h-10 w-10" />,
      title: "Collaboration",
      description: "We connect patients and healthcare providers seamlessly, fostering better communication and improved health outcomes."
    }
  ];

  const stats = [
    { number: "10,000+", label: "Active Users" },
    { number: "50,000+", label: "Health Records Managed" },
    { number: "99.9%", label: "Uptime Guarantee" },
    { number: "24/7", label: "AI Support Available" }
  ];

  const team = [
    {
      name: "Mayur Kaarthic S V",
      role: "Founder & Lead Developer",
      description: "Passionate about leveraging technology to make healthcare accessible and efficient for everyone."
    }
  ];

  useEffect(() => {
    const observedCards = new Set<string>();
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !observedCards.has(entry.target.id)) {
          observedCards.add(entry.target.id);
          setVisibleValues((prev) => ({
            ...prev,
            [entry.target.id]: true,
          }));
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
    });

    const timer = setTimeout(() => {
      const cards = document.querySelectorAll("[data-animate-value]");
      cards.forEach((card) => observer.observe(card));
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
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
              <div className="relative h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-gradient-to-br from-primary via-primary-light to-accent flex items-center justify-center shadow-lg shadow-primary/30 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/50 group-hover:scale-110 group-active:scale-95">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
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
                    item.path === "/about" 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {/* Background gradient - always visible for active, hover for others */}
                  {item.path === "/about" ? (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary-light opacity-100 transition-opacity duration-300"></div>
                  ) : (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  )}
                  
                  {/* Border effect */}
                  <div className={`absolute inset-0 rounded-lg border transition-colors duration-300 ${
                    item.path === "/about"
                      ? "border-primary/30"
                      : "border-transparent group-hover:border-primary/30"
                  }`}></div>
                  
                  {/* Text */}
                  <span className="relative flex items-center gap-1">
                    {item.label}
                    {item.path !== "/about" && (
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
              <div className="py-4 border-t border-primary/20 bg-gradient-to-b from-primary/5 to-accent/5 rounded-xl mt-2">
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
                      {item.path === "/about" ? (
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary-light"></div>
                      ) : (
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      )}
                      
                      {/* Text */}
                      <span className={`relative z-10 flex items-center gap-2 transition-colors duration-300 ${
                        item.path === "/about" 
                          ? "text-primary-foreground" 
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}>
                        {item.label}
                        <span className={`inline-block opacity-0 transition-all duration-300 ${
                          item.path === "/about" 
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold">
              <span className="bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
                Empowering Your
              </span>
              <br />
              <span className="text-foreground">Health Journey</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              MCare is on a mission to make healthcare management simple, secure, and accessible for everyone
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="inline-flex p-4 rounded-md bg-gradient-to-br from-primary to-primary-light text-white shadow-lg">
                <Target className="h-12 w-12" />
              </div>
              <h2 className="text-4xl font-bold">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                To revolutionize healthcare management by providing an intuitive, AI-powered platform that puts patients in control of their health data. We believe everyone deserves easy access to their medical information and the tools to make informed health decisions.
              </p>
            </div>
            <div className="space-y-6">
              <div className="inline-flex p-4 rounded-md bg-gradient-to-br from-accent to-primary-light text-white shadow-lg">
                <Eye className="h-12 w-12" />
              </div>
              <h2 className="text-4xl font-bold">Our Vision</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A world where healthcare is seamlessly integrated into daily life, where patients and providers collaborate effortlessly, and where technology empowers better health outcomes for all. We're building the future of personalized healthcare.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {stat.number}
                </div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Core Values</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const valueId = `value-${index + 1}`;
              const delayClass = ['animate-delay-100', 'animate-delay-200', 'animate-delay-300', 'animate-delay-400'][index % 4];
              return (
              <div
                key={index}
                id={valueId}
                data-animate-value
                className={`group relative p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 ${
                  visibleValues[valueId] ? `animate-fade-in-slide-up ${delayClass}` : ''
                }`}
                style={!visibleValues[valueId] ? { opacity: 0, transform: 'translateY(30px)' } : undefined}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative space-y-4">
                  <div className="inline-flex p-3 rounded-md bg-primary/10 text-primary">
                    {value.icon}
                  </div>
                  <h3 className="text-2xl font-bold">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Meet the Developer</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Dedicated to transforming healthcare technology
            </p>
          </div>
          <div className="flex justify-center">
            <div className="max-w-md p-8 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="space-y-6 text-center">
                <div className="relative inline-block">
                  <div className="w-40 h-40 mx-auto rounded-full overflow-hidden shadow-lg ring-4 ring-primary/20 animate-pulse-glow">
                    <img 
                      src={mayurPhoto} 
                      alt="Mayur Kaarthic S V" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <style>{`
                    @keyframes pulse-glow {
                      0%, 100% {
                        box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.2);
                      }
                      50% {
                        box-shadow: 0 0 30px rgba(59, 130, 246, 0.5), 0 0 60px rgba(59, 130, 246, 0.3), 0 0 80px rgba(59, 130, 246, 0.2);
                      }
                    }
                    .animate-pulse-glow {
                      animation: pulse-glow 3s ease-in-out infinite;
                    }
                  `}</style>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">Mayur Kaarthic S V</h3>
                  <p className="text-primary font-medium mb-3">Founder & Lead Developer</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Passionate about leveraging technology to make healthcare accessible and efficient for everyone.
                  </p>
                </div>
                <a
                  href="https://www.linkedin.com/in/mayur005"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  Connect on LinkedIn
                  <TrendingUp className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-8 bg-gradient-to-br from-primary to-primary-light rounded-xl p-12 md:p-16 text-primary-foreground shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold">
              Join Us in Transforming Healthcare
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Be part of a community that's taking control of their health journey
            </p>
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
                      Get Started Today
                    </span>
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MCare. All rights reserved.</p>
            <p>
              Designed by{" "}
              <a
                href="https://www.linkedin.com/in/mayur005"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Mayur Kaarthic S V
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;