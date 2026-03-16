import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.06)_0%,_transparent_70%)]" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-2xl text-foreground">ScoreLab</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Start finding your <span className="text-gradient-primary">edge</span> today.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Join thousands of analysts using data-driven methods to make smarter betting decisions.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-lg text-foreground">ScoreLab</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Get started with 5 free analyses per day.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <Button type="submit" variant="hero" className="w-full" size="lg">
              Create Account <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
