import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, User, Search, Menu as MenuIcon, X } from 'lucide-react';
import heroBg from '../assets/rvce_hero_real.jpg';
import libraryInterior from '../assets/rvce_library_real_1.jpg';
import libraryReading from '../assets/rvce_library_real_2.webp';
import logo from '../assets/rvce_logo_blended.png';

const Navbar = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-6'}`}>
            <div className="container mx-auto px-6 flex items-center justify-between">
                {/* Left: Search */}
                <div className="flex items-center space-x-4 opacity-0 lg:opacity-100 transition-opacity">
                    <button className={`p-2 rounded-full hover:bg-black/5 transition-colors ${scrolled ? 'text-navy' : 'text-white'}`}>
                        <Search size={20} />
                    </button>
                    <span className={`hidden xl:inline text-sm font-medium tracking-wider ${scrolled ? 'text-navy' : 'text-white'}`}>SEARCH</span>
                </div>

                {/* Center: Logo */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center cursor-pointer" onClick={() => navigate('/')}>
                    <img src={logo} alt="RVCE Seal" className={`transition-all duration-300 ${scrolled ? 'h-12' : 'h-16'}`} />
                    {!scrolled && <span className="mt-2 text-white font-serif tracking-[0.2em] text-xs font-bold uppercase">RV College of Engineering</span>}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-6">
                    <button
                        onClick={() => navigate('/login')}
                        className={`hidden md:flex items-center space-x-2 font-medium text-sm tracking-wide px-5 py-2 rounded-full border transition-all ${scrolled ? 'border-navy text-navy hover:bg-navy hover:text-white' : 'border-white text-white hover:bg-white hover:text-navy'}`}
                    >
                        <User size={16} />
                        <span>ADMIN / TEACHER LOGIN</span>
                    </button>
                    <button className={`p-2 ${scrolled ? 'text-navy' : 'text-white'}`} onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X size={28} /> : <MenuIcon size={28} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay (Simplified) */}
            {menuOpen && (
                <div className="fixed inset-0 bg-navy z-[100] flex flex-col items-center justify-center text-white" style={{ backgroundColor: '#002147' }}>
                    <button className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors" onClick={() => setMenuOpen(false)}><X size={32} /></button>
                    <nav className="flex flex-col space-y-8 text-center font-serif text-3xl">
                        <a href="#" className="hover:text-gold transition-colors">Admissions</a>
                        <a href="#" className="hover:text-gold transition-colors">Academic Life</a>
                        <a href="#" className="hover:text-gold transition-colors">Campus</a>
                        <a href="#" className="hover:text-gold transition-colors">Contact</a>
                        <button onClick={() => navigate('/login')} className="mt-8 text-lg font-sans border border-white px-8 py-3 rounded-full hover:bg-white hover:text-navy transition-colors">Login Portal</button>
                    </nav>
                </div>
            )}
        </header>
    );
};

const Hero = () => {
    const { scrollY } = useScroll();
    const y = useTransform(scrollY, [0, 500], [0, 150]);
    const opacity = useTransform(scrollY, [0, 300], [1, 0]);

    return (
        <section className="relative h-screen overflow-hidden bg-navy" style={{ backgroundColor: '#002147' }}>
            <motion.div style={{ y }} className="absolute inset-0">
                <img src={heroBg} alt="Campus" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-navy/90" />
            </motion.div>

            <motion.div style={{ opacity }} className="relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-4">
                <motion.span
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="mb-6 text-sm md:text-base font-sans tracking-[0.3em] uppercase text-gold"
                >
                    Excellence in Education since 1963
                </motion.span>
                <motion.h1
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}
                    className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight mb-8"
                >
                    A Tradition of <br /><span className="italic font-light">Innovation</span>
                </motion.h1>
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                    className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce"
                >
                    <ChevronDown size={32} className="text-white/70" />
                </motion.div>
            </motion.div>
        </section>
    );
};

const StatsBar = () => {
    return (
        <div className="bg-navy py-16 text-white border-t border-white/10" style={{ backgroundColor: '#002147' }}>
            <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
                <div className="p-4">
                    <div className="font-serif text-5xl mb-2 text-gold">1st</div>
                    <div className="font-sans text-sm tracking-widest uppercase opacity-80">Engineering College in Region</div>
                </div>
                <div className="p-4">
                    <div className="font-serif text-5xl mb-2 text-gold">98%</div>
                    <div className="font-sans text-sm tracking-widest uppercase opacity-80">Placement Record</div>
                </div>
                <div className="p-4">
                    <div className="font-serif text-5xl mb-2 text-gold">150+</div>
                    <div className="font-sans text-sm tracking-widest uppercase opacity-80">Research Labs</div>
                </div>
            </div>
        </div>
    );
};

const FeatureSection = () => {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row items-center gap-16 mb-24">
                    <div className="md:w-1/2 relative group cursor-pointer">
                        <div className="overflow-hidden rounded-sm shadow-2xl">
                            <img src={libraryInterior} alt="Library Interior" className="w-full h-[600px] object-cover transition-transform duration-700 group-hover:scale-105" />
                        </div>
                        <div className="absolute -bottom-10 -right-10 bg-accent-navy p-8 shadow-xl max-w-xs hidden md:block">
                            <p className="font-serif text-xl text-white italic">"A sanctuary for knowledge and innovation."</p>
                        </div>
                    </div>
                    <div className="md:w-1/2">
                        <span className="text-accent-navy font-bold tracking-widest text-xs uppercase mb-4 block">Academic Excellence</span>
                        <h2 className="text-5xl mb-8 leading-tight font-serif text-accent-navy">State-of-the-Art <br />Library & Resources</h2>
                        <p className="text-gray-900 mb-8 text-lg leading-relaxed font-light">
                            Our newly renovated library offers an extensive collection of digital and physical resources. Designed for focused study and collaborative research, it sits at the heart of our academic community.
                        </p>
                        <button className="group flex items-center space-x-3 text-accent-navy font-medium tracking-wide border-b border-accent-navy pb-1 hover:text-accent-gold hover:border-accent-gold transition-colors">
                            <span>EXPLORE RESOURCES</span>
                            <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row-reverse items-center gap-16">
                    <div className="md:w-1/2 relative group cursor-pointer">
                        <div className="overflow-hidden rounded-sm shadow-2xl">
                            <img src={libraryReading} alt="Reading Room" className="w-full h-[600px] object-cover transition-transform duration-700 group-hover:scale-105" />
                        </div>
                    </div>
                    <div className="md:w-1/2 md:text-right">
                        <span className="text-accent-navy font-bold tracking-widest text-xs uppercase mb-4 block">Campus Facilities</span>
                        <h2 className="text-5xl mb-8 leading-tight font-serif text-accent-navy">Quiet Space <br />For Reflection</h2>
                        <p className="text-gray-900 mb-8 text-lg leading-relaxed font-light">
                            The reading rooms provide a serene environment with views of our lush campus greenery. It is the perfect space for students to immerse themselves in their studies.
                        </p>
                        <button className="group flex items-center space-x-3 text-accent-navy font-medium tracking-wide border-b border-accent-navy pb-1 hover:text-accent-gold hover:border-accent-gold transition-colors ml-auto">
                            <span>VIRTUAL TOUR</span>
                            <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => {
    return (
        <footer className="bg-navy text-white pt-20 pb-10 border-t border-white/10" style={{ backgroundColor: '#002147' }}>
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="space-y-6">
                        <img src={logo} alt="RVCE" className="h-20" />
                        <p className="text-white/60 font-light max-w-xs">
                            RV College of Engineering<br />
                            Mysore Road, RV Vidyaniketan Post<br />
                            Bengaluru - 560059
                        </p>
                    </div>
                    <div>
                        <h4 className="font-serif text-xl mb-6 text-gold">Admissions</h4>
                        <ul className="space-y-4 text-white/70 font-light">
                            <li><a href="#" className="hover:text-white transition-colors">Undergraduate</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Postgraduate</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Ph.D Programs</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Scholarships</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-serif text-xl mb-6 text-gold">Departments</h4>
                        <ul className="space-y-4 text-white/70 font-light">
                            <li><a href="#" className="hover:text-white transition-colors">Computer Science</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Aerospace</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Mechanical</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Civil Engineering</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-serif text-xl mb-6 text-gold">Connect</h4>
                        <div className="flex space-x-4">
                            {/* Social Icons Placeholder */}
                            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-navy transition-colors cursor-pointer">in</div>
                            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-navy transition-colors cursor-pointer">tw</div>
                            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-navy transition-colors cursor-pointer">ig</div>
                        </div>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-white/40 text-sm">
                    <p>&copy; 2026 RV College of Engineering. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-white">Privacy Policy</a>
                        <a href="#" className="hover:text-white">Terms of Use</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-bg-primary font-sans-body">
            <Navbar />
            <Hero />
            <StatsBar />
            <FeatureSection />
            <Footer />
        </div>
    );
};

export default LandingPage;
