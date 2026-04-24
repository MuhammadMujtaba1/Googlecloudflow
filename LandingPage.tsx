import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    
    reveals.forEach(r => observer.observe(r));

    return () => {
      reveals.forEach(r => observer.unobserve(r));
    };
  }, []);

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  return (
    <div className="bg-slate-50 text-slate-900 antialiased font-sans overflow-x-hidden scroll-smooth">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center cursor-pointer transition-transform hover:scale-105">
            <span className="text-2xl font-black tracking-tight text-indigo-600">FlowThread</span>
          </div>
          <button 
            onClick={handleGetStarted} 
            className="shiny-button rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            Join Beta
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h1 className="reveal mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
            Freelancing became <span className="gradient-text">easy</span> and you can get clients <span className="gradient-text">faster</span>
          </h1>
          <p className="reveal delay-100 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Stop "Alt-Tabbing" your life away. FlowThread is where work conversations become finished tasks—replacing WhatsApp, Notion, and Stripe with a single engine.
          </p>
          <div className="reveal delay-200 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button 
              onClick={handleGetStarted} 
              className="shiny-button w-full rounded-2xl bg-indigo-600 px-10 py-5 text-lg font-bold text-white shadow-xl sm:w-auto"
            >
              Start Getting Clients/Freelancers Faster
            </button>
          </div>
        </div>

        <div className="reveal delay-300 mx-auto mt-24 max-w-6xl px-6">
          <div className="rounded-[2.5rem] bg-slate-50 bg-grid-pattern p-8 shadow-2xl ring-1 ring-slate-200 relative overflow-hidden">
            <div className="absolute -top-[50%] -left-[10%] w-[70%] h-[100%] rounded-full bg-indigo-200/40 blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-[50%] -right-[10%] w-[70%] h-[100%] rounded-full bg-purple-200/40 blur-[100px] pointer-events-none"></div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="glass-card md:col-span-2 rounded-3xl p-8 flex flex-col justify-center shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-sm font-bold text-slate-500 tracking-widest uppercase">The Chaos vs. The Flow</span>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">The Chat-to-Task Engine.</h3>
                <p className="text-slate-600 text-lg mb-8 max-w-lg">Every message instantly becomes a structured workflow. No more losing project details or clients in long WhatsApp threads.</p>
                
                <div className="flex flex-wrap items-center gap-4 text-slate-700 font-mono text-sm">
                  <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm animate-float-slow" style={{ animationDelay: '0s' }}>💬 "Project Brief"</div>
                  <div className="text-indigo-400">→</div>
                  <div className="bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-200 animate-float-slow shadow-[0_0_15px_rgba(79,70,229,0.15)] text-indigo-700" style={{ animationDelay: '0.5s' }}>📝 Task Created</div>
                  <div className="text-indigo-400">→</div>
                  <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200 animate-float-slow text-emerald-700 shadow-sm" style={{ animationDelay: '1s' }}>💰 Payment Secured</div>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-8 relative overflow-hidden shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Build Trust Faster</h3>
                <p className="text-slate-600 text-sm mb-6">A vertical "Proof-of-Work" timeline that shows clients exactly what you've done.</p>
                
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-400 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-500 text-white shadow-md shrink-0 animate-pulse-ring z-10">✓</div>
                    <div className="w-[calc(100%-4rem)] bg-white p-3 rounded-lg border border-slate-200 shadow-sm ml-4">
                      <p className="text-xs font-semibold text-slate-800">Draft Delivered</p>
                    </div>
                  </div>
                  <div className="relative flex items-center justify-between md:justify-normal group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-200 text-slate-500 shadow-md shrink-0 z-10">⏳</div>
                    <div className="w-[calc(100%-4rem)] bg-white p-3 rounded-lg border border-slate-200 shadow-sm ml-4">
                      <p className="text-xs font-semibold text-slate-500">Awaiting Feedback</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Freelancing Simplified</h3>
                <p className="text-slate-600 text-sm mb-6">Ditch the $35/mo subscription fatigue.</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm text-slate-400 line-through decoration-red-500/60">
                    <span>Slack + Notion + Drive</span>
                    <span>$35.00</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-400 line-through decoration-red-500/60">
                    <span>Platform Fees</span>
                    <span>20%</span>
                  </div>
                  <div className="w-full h-px bg-slate-200 my-2"></div>
                  <div className="flex justify-between items-center font-extrabold text-emerald-600 text-lg">
                    <span>FlowThread</span>
                    <span>$0.00</span>
                  </div>
                </div>
              </div>

              <div className="glass-card md:col-span-2 rounded-3xl p-8 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white shadow-sm">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Close Deals Faster</h3>
                  <p className="text-slate-600 text-sm max-w-sm">Built-in escrow ensures you get paid for your hard work. Money moves directly to your local wallet upon delivery.</p>
                </div>
                <div className="hidden sm:flex flex-col gap-2">
                  <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-full text-xs font-bold text-center shadow-sm">Stripe Integration</span>
                  <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-full text-xs font-bold text-center shadow-sm">JazzCash Ready</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section id="payments" className="bg-white py-24 mt-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="reveal text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Payouts Designed for You.</h2>
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <div className="reveal delay-100 p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-slate-500 uppercase">Stripe</span>
            </div>
            <div className="reveal delay-100 p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-slate-500 uppercase">PayPal</span>
            </div>
            <div className="reveal delay-200 p-6 bg-indigo-50 rounded-2xl border border-indigo-200 hover:border-indigo-500 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-indigo-600 uppercase">JazzCash</span>
            </div>
            <div className="reveal delay-200 p-6 bg-indigo-50 rounded-2xl border border-indigo-200 hover:border-indigo-500 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-indigo-600 uppercase">Easypaisa</span>
            </div>
            <div className="reveal delay-300 p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-slate-500 uppercase">Visa/MC</span>
            </div>
            <div className="reveal delay-300 p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300">
              <span className="text-xs font-bold text-slate-500 uppercase">SadaPay</span>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="reveal relative isolate overflow-hidden bg-indigo-600 px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to get clients/freelancers faster?</h2>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button 
                onClick={handleGetStarted} 
                className="shiny-button rounded-xl bg-white px-10 py-5 text-xl font-bold text-indigo-600 shadow-xl hover:bg-slate-50"
              >
                Get Early Access Now
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-50 py-12 text-center">
        <span className="text-xl font-black text-slate-900">FlowThread</span>
        <p className="mt-4 text-sm text-slate-500">&copy; 2026 FlowThread. Built for faster freelancing.</p>
      </footer>
    </div>
  );
}
