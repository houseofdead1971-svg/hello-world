import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Shield, Sparkles, FileHeart, Pill, Clock, ChevronLeft, ChevronRight, Calendar, MessageSquare, Phone, Linkedin, Users, Heart, Stethoscope, Award, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTransition } from "@/App";
import doctorVideo from "@/assets/doctor_video.mp4";

const Landing = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { startTransition } = usePageTransition();
  const navigate = useNavigate();

  const slides = [
    {
      icon: <Sparkles className="h-16 w-16" />,
      title: "AI Health Assistant",
      description: "Get instant answers to your health questions with our intelligent AI assistant. Available 24/7 to help you understand your medications, symptoms, and health records.",
      gradient: "from-primary to-primary-light"
    },
    {
      icon: <Pill className="h-16 w-16" />,
      title: "Medication Tracking",
      description: "Never miss a dose again. Track all your medications, set reminders, and view your complete medication history in one convenient place.",
      gradient: "from-primary-light to-accent"
    },
    {
      icon: <Calendar className="h-16 w-16" />,
      title: "Health Timeline",
      description: "Visualize your complete health journey. Track appointments, lab results, procedures, and important health events all in a chronological timeline.",
      gradient: "from-accent to-primary"
    },
    {
      icon: <FileHeart className="h-16 w-16" />,
      title: "Secure Records",
      description: "Upload, organize, and access your medical records anytime, anywhere. HIPAA-compliant encryption keeps your health data safe and private.",
      gradient: "from-primary-dark to-primary"
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 4000);

    return () => clearInterval(interval);
  }, [currentSlide]);

  return (
    <div className="min-h-screen relative isolate overflow-hidden">
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
                  className="group relative px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground"
                >
                  {/* Background gradient on hover */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>

                  {/* Border effect on hover */}
                  <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-primary/30 transition-colors duration-300"></div>

                  {/* Text with underline animation */}
                  <span className="relative flex items-center gap-1">
                    {item.label}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full group-hover:w-full transition-all duration-500"></span>
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
              className="lg:hidden p-2.5 hover:bg-accent/20 active:bg-accent/30 rounded-xl transition-all duration-300 relative group"
              aria-label="Toggle menu"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              {mobileMenuOpen ? (
                <X className="h-6 w-6 relative z-10 transition-transform duration-300 rotate-90" />
              ) : (
                <Menu className="h-6 w-6 relative z-10 transition-transform duration-300 group-hover:rotate-180" />
              )}
            </button>
          </div>

          {/* Mobile Menu with Smooth Animation */}
          <div
            className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
              }`}
          >
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
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    {/* Border hover effect */}
                    <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-primary/30 transition-colors duration-300"></div>

                    {/* Text */}
                    <span className="relative z-10 text-muted-foreground group-hover:text-foreground transition-colors duration-300 flex items-center gap-2">
                      {item.label}
                      <span className="inline-block opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">→</span>
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
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-[75vh] md:min-h-screen flex items-center overflow-hidden pt-16">
        {/* Video background - plays on all screen sizes */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-[-1]"
          aria-hidden="true"
        >
          <source src={doctorVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-background/40 via-background/20 to-background/40 md:from-background/20 md:via-transparent md:to-background/20" />
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="text-blue-800">Your Health, </span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-light">
                Connected & Secure
              </span>
            </h1>

            <p className="text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-light">
              Manage your health records, track medications, and get AI-powered health insights—all in one secure platform.
            </p>

            <div className="pt-4 flex justify-center">
              <Link
                to="/auth"
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg inline-block"
              >
                <div className="relative h-14 rounded-lg overflow-hidden shadow-lg transition-shadow duration-300 group-hover:shadow-xl group-active:shadow-xl">
                  {/* Gradient border wrapper */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary-light opacity-40" />
                  {/* Button surface with slide-up fill */}
                  <div className="relative z-10 flex h-14 items-center justify-center px-8 rounded-lg ring-1 ring-border text-lg font-medium text-foreground overflow-hidden">
                    {/* Slide-up accent background */}
                    <span className="absolute inset-0 bg-accent origin-bottom scale-y-0 transition-transform duration-500 ease-out group-hover:scale-y-100 group-active:scale-y-100" aria-hidden="true" />
                    {/* Text with color inversion */}
                    <span className="relative z-10 transition-colors duration-500 ease-out group-hover:text-primary-foreground group-active:text-primary-foreground">
                      Get Started Free
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Carousel Section */}
      <section className="py-24 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover what makes MCare the complete health management solution
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative">
              {/* Carousel Content */}
              <div className="overflow-hidden rounded-xl">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((slide, index) => (
                    <div
                      key={index}
                      className="min-w-full px-4"
                    >
                      <div className={`bg-gradient-to-br ${slide.gradient} rounded-xl p-12 md:p-16 text-white shadow-2xl`}>
                        <div className="flex flex-col items-center text-center space-y-6">
                          <div className="p-6 bg-white/20 rounded-md backdrop-blur-sm">
                            {slide.icon}
                          </div>
                          <h3 className="text-3xl md:text-4xl font-bold">
                            {slide.title}
                          </h3>
                          <p className="text-lg md:text-xl opacity-90 max-w-2xl leading-relaxed">
                            {slide.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indicators */}
              <div className="flex justify-center gap-2 mt-8">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 rounded-full transition-all ${index === currentSlide
                        ? 'w-8 bg-primary'
                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive health management tools designed for your well-being
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="AI Health Assistant"
              description="Get personalized health insights and answers to your questions with our AI-powered assistant"
            />
            <FeatureCard
              icon={<Clock className="h-8 w-8" />}
              title="Health Timeline"
              description="Track your health journey with a comprehensive timeline of all your medical records and events"
            />
            <FeatureCard
              icon={<Pill className="h-8 w-8" />}
              title="Medication Tracker"
              description="Never miss a dose with smart medication reminders and tracking"
            />
            <FeatureCard
              icon={<FileHeart className="h-8 w-8" />}
              title="Records Management"
              description="Upload, organize, and access your medical records securely from anywhere"
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="HIPAA Compliant"
              description="Your health data is encrypted and protected with industry-leading security"
            />
            <FeatureCard
              icon={<Activity className="h-8 w-8" />}
              title="Health Insights"
              description="Get actionable insights from your health data to make informed decisions"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-background to-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-br from-primary to-primary-light rounded-xl p-12 md:p-16 text-primary-foreground shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Take Control of Your Health?
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Join thousands of users managing their health with MCare
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/auth" className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 rounded-lg">
                <div className="relative h-14 rounded-lg overflow-hidden shadow-lg transition-shadow duration-300 group-hover:shadow-2xl">
                  {/* Light background with border */}
                  <div className="absolute inset-0 rounded-lg bg-white/10" />
                  {/* Button surface with slide-up fill */}
                  <div className="relative z-10 flex h-14 items-center justify-center px-8 rounded-lg bg-white text-lg font-medium text-blue-600 overflow-hidden">
                    {/* Slide-up blue background */}
                    <span className="absolute inset-0 bg-blue-600 origin-bottom scale-y-0 transition-transform duration-500 ease-out group-hover:scale-y-100" aria-hidden="true" />
                    {/* Text with color inversion */}
                    <span className="relative z-10 transition-colors duration-500 ease-out group-hover:text-white">
                      Get Started Free
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">Get In Touch</h2>
            <p className="text-lg text-muted-foreground">
              Have questions? We're here to help
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-4">
              <a
                href="https://wa.me/919445431413"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-4 rounded-lg bg-[#25D366] hover:bg-[#20BA5A] text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <Phone className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs opacity-90">+91 9445431413</p>
                </div>
              </a>

              <a
                href="https://www.linkedin.com/in/mayur005"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-4 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <Linkedin className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-medium">LinkedIn</p>
                  <p className="text-xs opacity-90">Connect with us</p>
                </div>
              </a>
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

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  return (
    <div className="group p-8 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="inline-flex p-3 rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

export default Landing;
